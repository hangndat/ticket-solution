import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  hashRedemptionCode,
  type CodeHmacConfig,
} from './code-hmac';
import {
  IssueError,
  ISSUE_ERROR_CODES,
  type IssueErrorCode,
} from './issue-error';

export const REDEEM_COMMAND = 'redemption.redeem' as const;

export type RedeemInput = {
  tenantId: string;
  eventId: string;
  actorUserId: string;
  actorEmail: string | null;
  emailVerified: boolean;
  rawCode: string;
  /** Client UUID Idempotency-Key (required). */
  idempotencyKey: string;
  formVersion?: string;
  termsVersion?: string;
};

export type IssuedTicketResult = {
  ticketId: string;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: 'ACTIVE';
  credentialVersion: number;
  replayed: boolean;
};

type EventPolicyRow = {
  id: string;
  status: string;
  redemption_opens_at: Date | null;
  redemption_closes_at: Date | null;
};

type CodeRow = {
  id: string;
  source_id: string;
  ticket_type_id: string;
  status: string;
  entitlement_snapshot: Prisma.JsonValue;
};

type QuotaRow = {
  id: string;
  scope: string;
  scope_id: string | null;
  capacity: number | null;
  allocated: number;
};

type OperationRow = {
  id: string;
  request_hash: string;
  status: string;
  response_json: Prisma.JsonValue | null;
};

type AttendeeRow = { id: string };
type CounterRow = { issued_count: number; max_tickets: number | null };

function canonicalRequestHash(input: {
  tenantId: string;
  eventId: string;
  rawCode: string;
  formVersion?: string;
  termsVersion?: string;
}): string {
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    eventId: input.eventId,
    code: input.rawCode.trim().toUpperCase(),
    formVersion: input.formVersion ?? null,
    termsVersion: input.termsVersion ?? null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function scopeOrder(scope: string): number {
  if (scope === 'EVENT') return 0;
  if (scope === 'TICKET_TYPE') return 1;
  if (scope === 'ISSUANCE_SOURCE') return 2;
  return 99;
}

function sealCredentialToken(
  token: string,
  keyMaterial: string,
): { tokenHash: string; encryptedToken: string; kid: string } {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const key = createHash('sha256').update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const encryptedToken = Buffer.concat([iv, tag, ciphertext]).toString(
    'base64url',
  );
  return { tokenHash, encryptedToken, kid: 'local-v1' };
}

function mapIssuedResponse(
  row: OperationRow,
  replayed: boolean,
): IssuedTicketResult {
  const body = row.response_json as IssuedTicketResult | null;
  if (!body || typeof body !== 'object' || !('ticketId' in body)) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
      'Idempotent operation is still in progress',
      true,
    );
  }
  return { ...body, operationId: row.id, replayed };
}

/**
 * Auto-issue redemption inside an open withTenant transaction (TD §8.2).
 * Caller must set tenant context; Redis must not decide quota.
 */
export async function redeemAndIssueTicket(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  credentialKeyMaterial: string,
  input: RedeemInput,
): Promise<IssuedTicketResult> {
  if (!input.emailVerified) {
    throw new IssueError(
      ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED,
      'Email must be verified before issuing a ticket',
    );
  }
  const key = input.idempotencyKey?.trim();
  if (
    !key ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      key,
    )
  ) {
    throw new IssueError(
      ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
    );
  }

  const requestHash = canonicalRequestHash(input);
  const operationId = randomUUID();

  // 1) Claim idempotency operation (ON CONFLICT DO NOTHING).
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
      ${input.actorUserId}::uuid, ${REDEEM_COMMAND}, ${key},
      ${requestHash}, 'IN_PROGRESS', now(), now()
    )
    ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
    DO NOTHING
  `;

  const ops = await tx.$queryRaw<OperationRow[]>`
    SELECT id, request_hash, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${REDEEM_COMMAND}
      AND client_key = ${key}
    FOR UPDATE
  `;
  const op = ops[0];
  if (!op) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to claim idempotency operation',
      true,
    );
  }
  if (op.request_hash !== requestHash) {
    throw new IssueError(
      ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key was reused with a different request',
    );
  }
  if (op.status === 'COMPLETED') {
    throwIfStoredRejection(op.response_json);
    return mapIssuedResponse(op, true);
  }
  if (op.status === 'FAILED') {
    throw new IssueError(
      ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key already finished with a terminal failure; use a new key',
    );
  }

  // Savepoint so business rejection can persist a clean terminal response
  // without leaving half-mutated counters (TD §8.1).
  await tx.$executeRaw`SAVEPOINT issue_business`;

  try {
    const result = await runIssueBusiness(
      tx,
      hmac,
      credentialKeyMaterial,
      input,
      op.id,
    );
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify(result)}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${op.id}::uuid
    `;
    await tx.$executeRaw`RELEASE SAVEPOINT issue_business`;
    return { ...result, replayed: false };
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT issue_business`;
    if (error instanceof IssueError && !error.retryable) {
      // Terminal business rejection: keep operation completed with error payload
      // so retries with same key replay the rejection without re-mutating.
      const rejection = {
        code: error.code,
        message: error.message,
        retryable: false,
      };
      await tx.$executeRaw`
        UPDATE operations
        SET status = 'COMPLETED',
            response_json = ${JSON.stringify(rejection)}::jsonb,
            updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${op.id}::uuid
      `;
    }
    throw error;
  }
}

async function runIssueBusiness(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  credentialKeyMaterial: string,
  input: RedeemInput,
  operationId: string,
): Promise<Omit<IssuedTicketResult, 'replayed'>> {
  // 2) Event policy FOR SHARE
  const events = await tx.$queryRaw<EventPolicyRow[]>`
    SELECT id, status, redemption_opens_at, redemption_closes_at
    FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
    FOR SHARE
  `;
  const event = events[0];
  if (!event || event.status !== 'PUBLISHED') {
    throw new IssueError(
      ISSUE_ERROR_CODES.EVENT_CLOSED,
      'Event is not open for redemption',
    );
  }
  const nowRows = await tx.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp() AS now
  `;
  const now = nowRows[0]?.now ?? new Date();
  if (
    (event.redemption_opens_at && now < event.redemption_opens_at) ||
    (event.redemption_closes_at && now > event.redemption_closes_at)
  ) {
    throw new IssueError(
      ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED,
      'Redemption window is closed',
    );
  }

  // 3) Lock code FOR UPDATE
  const codeHmac = hashRedemptionCode(hmac, input.rawCode);
  const codes = await tx.$queryRaw<CodeRow[]>`
    SELECT c.id, c.source_id, c.ticket_type_id, c.status,
           t.entitlement_snapshot
    FROM redemption_codes c
    JOIN ticket_types t
      ON t.tenant_id = c.tenant_id AND t.id = c.ticket_type_id
    WHERE c.tenant_id = ${input.tenantId}::uuid
      AND c.event_id = ${input.eventId}::uuid
      AND c.code_hmac = ${codeHmac}
    FOR UPDATE OF c
  `;
  const code = codes[0];
  if (!code) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid',
    );
  }
  if (code.status === 'CONSUMED') {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_CONSUMED,
      'Redemption code has already been used',
    );
  }
  if (code.status === 'DISABLED' || code.status === 'HELD') {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_DISABLED,
      'Redemption code is not available',
    );
  }
  if (code.status !== 'AVAILABLE') {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid',
    );
  }

  // Allowlist source ↔ type
  const allowed = await tx.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok
    FROM source_ticket_types
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND source_id = ${code.source_id}::uuid
      AND ticket_type_id = ${code.ticket_type_id}::uuid
  `;
  if (!allowed[0]) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_DISABLED,
      'Redemption code type is not allowed for its source',
    );
  }

  // 4) Upsert attendee + lock counter
  const attendeeId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO event_attendees (
      tenant_id, event_id, id, user_id, canonical_email, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${attendeeId}::uuid,
      ${input.actorUserId}::uuid, ${input.actorEmail}, now(), now()
    )
    ON CONFLICT (tenant_id, event_id, user_id) DO NOTHING
  `;
  const attendees = await tx.$queryRaw<AttendeeRow[]>`
    SELECT id FROM event_attendees
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND user_id = ${input.actorUserId}::uuid
  `;
  const attendee = attendees[0];
  if (!attendee) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to resolve event attendee',
      true,
    );
  }
  await tx.$executeRaw`
    INSERT INTO attendee_counters (
      tenant_id, event_id, attendee_id, issued_count, max_tickets, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${attendee.id}::uuid,
      0, 5, now()
    )
    ON CONFLICT (tenant_id, attendee_id) DO NOTHING
  `;
  const counters = await tx.$queryRaw<CounterRow[]>`
    SELECT issued_count, max_tickets
    FROM attendee_counters
    WHERE tenant_id = ${input.tenantId}::uuid
      AND attendee_id = ${attendee.id}::uuid
    FOR UPDATE
  `;
  const counter = counters[0];
  if (!counter) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to lock attendee counter',
      true,
    );
  }
  if (
    counter.max_tickets !== null &&
    counter.issued_count >= counter.max_tickets
  ) {
    throw new IssueError(
      ISSUE_ERROR_CODES.ATTENDEE_LIMIT,
      'Attendee ticket limit reached',
    );
  }

  // 5) Lock quota buckets in deterministic order: EVENT → TYPE → SOURCE
  const quotas = await tx.$queryRaw<QuotaRow[]>`
    SELECT id, scope, scope_id, capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND (
        (scope = 'EVENT' AND scope_id IS NULL)
        OR (scope = 'TICKET_TYPE' AND scope_id = ${code.ticket_type_id}::uuid)
        OR (scope = 'ISSUANCE_SOURCE' AND scope_id = ${code.source_id}::uuid)
      )
    FOR UPDATE
  `;
  quotas.sort((a, b) => {
    const d = scopeOrder(a.scope) - scopeOrder(b.scope);
    if (d !== 0) return d;
    return (a.scope_id ?? '').localeCompare(b.scope_id ?? '');
  });
  if (quotas.length < 1) {
    throw new IssueError(
      ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      'No quota buckets configured for this event',
    );
  }
  for (const bucket of quotas) {
    if (bucket.capacity !== null && bucket.allocated >= bucket.capacity) {
      throw new IssueError(
        ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
        'Ticket quota is exhausted',
      );
    }
  }
  for (const bucket of quotas) {
    const updated = await tx.$executeRaw`
      UPDATE quota_buckets
      SET allocated = allocated + 1, updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${bucket.id}::uuid
        AND (capacity IS NULL OR allocated < capacity)
    `;
    // Prisma executeRaw returns affected row count for Postgres.
    if (Number(updated) !== 1) {
      throw new IssueError(
        ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
        'Ticket quota is exhausted',
      );
    }
  }

  await tx.$executeRaw`
    UPDATE attendee_counters
    SET issued_count = issued_count + 1, updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND attendee_id = ${attendee.id}::uuid
  `;

  // 6) Consume code, create request + ticket + credential
  const requestId = randomUUID();
  const ticketId = randomUUID();
  const notificationId = randomUUID();
  const outboxId = randomUUID();
  const auditId = randomUUID();

  await tx.$executeRaw`
    UPDATE redemption_codes
    SET status = 'CONSUMED',
        active_request_id = ${requestId}::uuid,
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${code.id}::uuid
      AND status = 'AVAILABLE'
  `;

  await tx.$executeRaw`
    INSERT INTO redemption_requests (
      tenant_id, event_id, id, actor_user_id, redemption_code_id,
      status, form_version, terms_version, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${requestId}::uuid,
      ${input.actorUserId}::uuid, ${code.id}::uuid, 'ISSUED',
      ${input.formVersion ?? null}, ${input.termsVersion ?? null},
      now(), now()
    )
  `;

  const entitlement =
    code.entitlement_snapshot && typeof code.entitlement_snapshot === 'object'
      ? code.entitlement_snapshot
      : {};

  await tx.$executeRaw`
    INSERT INTO tickets (
      tenant_id, event_id, id, owner_user_id, ticket_type_id, source_id,
      request_id, redemption_code_id, state, credential_version,
      entitlement_snapshot, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${ticketId}::uuid,
      ${input.actorUserId}::uuid, ${code.ticket_type_id}::uuid,
      ${code.source_id}::uuid, ${requestId}::uuid, ${code.id}::uuid,
      'ACTIVE', 1, ${JSON.stringify(entitlement)}::jsonb, now(), now()
    )
  `;

  const rawToken = randomBytes(32).toString('base64url');
  const sealed = sealCredentialToken(rawToken, credentialKeyMaterial);
  await tx.$executeRaw`
    INSERT INTO ticket_credentials (
      tenant_id, ticket_id, version, kid, token_hash, encrypted_token,
      status, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${ticketId}::uuid, 1, ${sealed.kid},
      ${sealed.tokenHash}, ${sealed.encryptedToken}, 'ACTIVE', now()
    )
  `;

  // 7) Audit + outbox TicketIssued + notification (same commit)
  const outboxPayload = {
    ticketId,
    requestId,
    ownerUserId: input.actorUserId,
    email: input.actorEmail,
    eventId: input.eventId,
  };
  await tx.$executeRaw`
    INSERT INTO outbox (
      tenant_id, event_id, id, type, aggregate_id, payload_version,
      payload, status, attempts, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${outboxId}::uuid,
      'TicketIssued', ${ticketId}::uuid, 1,
      ${JSON.stringify(outboxPayload)}::jsonb, 'PENDING', 0, now(), now()
    )
  `;
  const businessKey = `ticket:${ticketId}:issued:email`;
  await tx.$executeRaw`
    INSERT INTO notifications (
      tenant_id, event_id, id, business_key, channel, state,
      attempts, payload, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${notificationId}::uuid,
      ${businessKey}, 'email', 'PENDING', 0,
      ${JSON.stringify(outboxPayload)}::jsonb, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${auditId}::uuid,
      ${input.actorUserId}::uuid, 'ticket.issued', 'ticket',
      ${ticketId}::uuid,
      ${JSON.stringify({ requestId, codeId: code.id })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;

  return {
    ticketId,
    requestId,
    operationId,
    eventId: input.eventId,
    ticketTypeId: code.ticket_type_id,
    sourceId: code.source_id,
    state: 'ACTIVE',
    credentialVersion: 1,
  };
}

export type ListedTicket = {
  ticketId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: string;
  credentialVersion: number;
  createdAt: Date;
};

/** Owner My Tickets listing inside withTenant. */
export async function listTicketsForOwner(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ownerUserId: string,
): Promise<ListedTicket[]> {
  const rows = await tx.$queryRaw<
    {
      id: string;
      event_id: string;
      ticket_type_id: string;
      source_id: string;
      state: string;
      credential_version: number;
      created_at: Date;
    }[]
  >`
    SELECT id, event_id, ticket_type_id, source_id, state,
           credential_version, created_at
    FROM tickets
    WHERE tenant_id = ${tenantId}::uuid
      AND owner_user_id = ${ownerUserId}::uuid
    ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    ticketId: row.id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    sourceId: row.source_id,
    state: row.state,
    credentialVersion: row.credential_version,
    createdAt: row.created_at,
  }));
}

export async function getOperationForActor(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    command: string;
    clientKey: string;
  },
): Promise<{
  operationId: string;
  status: string;
  response: Prisma.JsonValue | null;
} | null> {
  const rows = await tx.$queryRaw<OperationRow[]>`
    SELECT id, request_hash, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${input.command}
      AND client_key = ${input.clientKey}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    operationId: row.id,
    status: row.status,
    response: row.response_json,
  };
}

/** Replay helper: if completed operation stored a rejection envelope, rethrow. */
export function throwIfStoredRejection(
  response: Prisma.JsonValue | null,
): void {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'code' in response &&
    typeof (response as { code: unknown }).code === 'string' &&
    !('ticketId' in response)
  ) {
    const body = response as {
      code: IssueErrorCode;
      message?: string;
      retryable?: boolean;
    };
    throw new IssueError(
      body.code,
      body.message ?? body.code,
      Boolean(body.retryable),
    );
  }
}
