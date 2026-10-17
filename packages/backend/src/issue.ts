import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { ApprovalError } from './approval-error';
import { holdCodeForReview } from './approval';
import {
  hashRedemptionCode,
  type CodeHmacConfig,
} from './code-hmac';
import {
  IssueError,
  ISSUE_ERROR_CODES,
  type IssueErrorCode,
} from './issue-error';
import {
  resolveAndValidateConsent,
  type ConsentSnapshot,
} from './form-consent';
import type { FormAnswerValue } from '@ticket/contracts';
import { expirePendingRequest } from './pending-expiry';
import {
  assertOpenForIssuance,
  lockEventPolicyForShare,
  dbClock,
} from './event-policy';

export const REDEEM_COMMAND = 'redemption.redeem' as const;
export const APPROVAL_PENDING = 'APPROVAL_PENDING' as const;

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
  answers?: Record<string, FormAnswerValue>;
  /** Explicit consent; must be true when published terms require it. */
  termsAccepted?: boolean;
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

/** MANUAL source: code is held, quota is not allocated, no ticket exists yet. */
export type PendingApprovalResult = {
  code: typeof APPROVAL_PENDING;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  status: 'PENDING_REVIEW';
  expiresAt?: string;
  replayed: boolean;
};

/** Terminal business rejection persisted on operations (TD §8.1). */
export type TerminalRejection = {
  code: IssueErrorCode;
  message: string;
  retryable: false;
  operationId: string;
};

/**
 * Outcome of redeemAndIssueTicket inside an open transaction.
 * Terminal rejections return `{ ok: false }` so the caller can commit the
 * COMPLETED operation row, then map to IssueError/HTTP outside withTenant.
 * Retryable / unexpected failures still throw and roll back the transaction.
 */
export type RedeemOutcome =
  | { ok: true; result: IssuedTicketResult }
  | { ok: 'pending'; result: PendingApprovalResult }
  | { ok: false; rejection: TerminalRejection };

type IssueBusinessResult =
  | { kind: 'issued'; ticket: Omit<IssuedTicketResult, 'replayed'> }
  | { kind: 'pending'; pending: Omit<PendingApprovalResult, 'replayed'> };


type CodeRow = {
  id: string;
  source_id: string;
  ticket_type_id: string;
  status: string;
  active_request_id: string | null;
  approval_mode: string;
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

/** Trim strings, drop empties, sort keys — must match consent snapshot shape. */
function normalizeAnswersForHash(
  answers: Record<string, FormAnswerValue> | undefined,
): Record<string, FormAnswerValue> {
  const out: Record<string, FormAnswerValue> = {};
  for (const key of Object.keys(answers ?? {}).sort()) {
    const value = answers![key];
    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) out[key] = trimmed;
    }
  }
  return out;
}

function canonicalRequestHash(input: {
  tenantId: string;
  eventId: string;
  rawCode: string;
  formVersion?: string | null;
  termsVersion?: string | null;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
}): string {
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    eventId: input.eventId,
    code: input.rawCode.trim().toUpperCase(),
    formVersion: input.formVersion?.trim() || null,
    termsVersion: input.termsVersion?.trim() || null,
    answers: normalizeAnswersForHash(input.answers),
    termsAccepted: input.termsAccepted === true ? true : null,
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
 * Map `{ ok: false }` to IssueError only after withTenant commits.
 */
export async function redeemAndIssueTicket(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  credentialKeyMaterial: string,
  input: RedeemInput,
): Promise<RedeemOutcome> {
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
    const pendingReplay = pendingFromStored(op.response_json);
    if (pendingReplay) {
      return {
        ok: 'pending',
        result: { ...pendingReplay, operationId: op.id, replayed: true },
      };
    }
    const stored = storedRejectionFromResponse(op.response_json);
    if (stored) {
      return {
        ok: false,
        rejection: {
          code: stored.code,
          message: stored.message,
          retryable: false,
          operationId: op.id,
        },
      };
    }
    return { ok: true, result: mapIssuedResponse(op, true) };
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
    const business = await runIssueBusiness(
      tx,
      hmac,
      credentialKeyMaterial,
      input,
      op.id,
    );
    const storedBody =
      business.kind === 'issued' ? business.ticket : business.pending;
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify(storedBody)}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${op.id}::uuid
    `;
    await tx.$executeRaw`RELEASE SAVEPOINT issue_business`;
    if (business.kind === 'pending') {
      return {
        ok: 'pending',
        result: { ...business.pending, replayed: false },
      };
    }
    return { ok: true, result: { ...business.ticket, replayed: false } };
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT issue_business`;
    if (error instanceof IssueError && !error.retryable) {
      // Terminal business rejection: keep operation completed with error payload
      // so retries with same key replay the rejection without re-mutating.
      // Return (do not throw) so withTenant can commit this UPDATE.
      const rejectionPayload = {
        code: error.code,
        message: error.message,
        retryable: false as const,
      };
      await tx.$executeRaw`
        UPDATE operations
        SET status = 'COMPLETED',
            response_json = ${JSON.stringify(rejectionPayload)}::jsonb,
            updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${op.id}::uuid
      `;
      await tx.$executeRaw`RELEASE SAVEPOINT issue_business`;
      return {
        ok: false,
        rejection: {
          ...rejectionPayload,
          operationId: op.id,
        },
      };
    }
    // Retryable / unexpected: leave transaction to roll back claim + mutations.
    throw error;
  }
}

async function runIssueBusiness(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  credentialKeyMaterial: string,
  input: RedeemInput,
  operationId: string,
): Promise<IssueBusinessResult> {
  // 2) Event policy FOR SHARE — content PUBLISHED, business ACTIVE, half-open window.
  const event = await lockEventPolicyForShare(
    tx,
    input.tenantId,
    input.eventId,
  );
  const now = await dbClock(tx);
  assertOpenForIssuance(event, now, 'issue');

  // Published form/terms gate (before code mutation).
  const { snapshot: consent } = await resolveAndValidateConsent(
    tx,
    input.tenantId,
    input.eventId,
    input,
  );

  // 3) Lock code FOR UPDATE
  const codeHmac = hashRedemptionCode(hmac, input.rawCode);
  const codes = await tx.$queryRaw<CodeRow[]>`
    SELECT c.id, c.source_id, c.ticket_type_id, c.status, c.active_request_id,
           s.approval_mode, t.entitlement_snapshot
    FROM redemption_codes c
    JOIN ticket_types t
      ON t.tenant_id = c.tenant_id AND t.id = c.ticket_type_id
    JOIN issuance_sources s
      ON s.tenant_id = c.tenant_id AND s.id = c.source_id
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
  if (code.status === 'DISABLED') {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_DISABLED,
      'Redemption code is not available',
    );
  }
  if (code.status === 'HELD') {
    return resumeOrRejectHold(tx, input, code, operationId);
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

  if (code.approval_mode === 'MANUAL') {
    return holdManualRedemption(tx, input, code, operationId, consent, now);
  }

  // 4) Upsert attendee + lock counter (AUTO issue only)
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
      0, ${event.max_tickets_per_attendee}, now()
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

  const consentAcceptedAt = consent.requiresConsentTimestamp ? now : null;
  await tx.$executeRaw`
    INSERT INTO redemption_requests (
      tenant_id, event_id, id, actor_user_id, redemption_code_id,
      status, form_version, terms_version, answers_json, terms_accepted,
      consent_accepted_at, form_definition_hash, terms_content_hash,
      decided_at, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${requestId}::uuid,
      ${input.actorUserId}::uuid, ${code.id}::uuid, 'ISSUED',
      ${consent.formVersion}, ${consent.termsVersion},
      ${JSON.stringify(consent.answers)}::jsonb, ${consent.termsAccepted},
      ${consentAcceptedAt}, ${consent.formDefinitionHash},
      ${consent.termsContentHash}, ${now}, now(), now()
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

  // 7) Audit + outbox TicketIssued + notification (same commit). No answers/PII in audit.
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
      tenant_id, event_id, id, business_key, channel, kind, payload_version,
      state, attempts, payload, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${notificationId}::uuid,
      ${businessKey}, 'email', 'TicketIssued', 1,
      'PENDING', 0,
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
      ${JSON.stringify({
        requestId,
        codeId: code.id,
        formVersion: consent.formVersion,
        termsVersion: consent.termsVersion,
        termsAccepted: consent.termsAccepted === true,
      })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;

  return {
    kind: 'issued',
    ticket: {
      ticketId,
      requestId,
      operationId,
      eventId: input.eventId,
      ticketTypeId: code.ticket_type_id,
      sourceId: code.source_id,
      state: 'ACTIVE',
      credentialVersion: 1,
    },
  };
}

function pendingBody(
  input: RedeemInput,
  code: CodeRow,
  requestId: string,
  operationId: string,
  expiresAt: Date | null,
): Omit<PendingApprovalResult, 'replayed'> {
  return {
    code: APPROVAL_PENDING,
    requestId,
    operationId,
    eventId: input.eventId,
    ticketTypeId: code.ticket_type_id,
    sourceId: code.source_id,
    status: 'PENDING_REVIEW',
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
  };
}

async function resumeOrRejectHold(
  tx: Prisma.TransactionClient,
  input: RedeemInput,
  code: CodeRow,
  operationId: string,
): Promise<IssueBusinessResult> {
  if (code.approval_mode === 'MANUAL' && code.active_request_id) {
    // Code already locked; lock request next (order: … → code → request).
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        actor_user_id: string;
        status: string;
        expires_at: Date | null;
      }>
    >`
      SELECT id, actor_user_id, status, expires_at
      FROM redemption_requests
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND id = ${code.active_request_id}::uuid
      FOR UPDATE
    `;
    const pending = rows[0];
    if (
      pending &&
      pending.status === 'PENDING_REVIEW' &&
      pending.actor_user_id === input.actorUserId
    ) {
      const expired = await expirePendingRequest(tx, {
        tenantId: input.tenantId,
        eventId: input.eventId,
        requestId: pending.id,
        actorUserId: input.actorUserId,
      });
      if (expired.expired) {
        throw new IssueError(
          ISSUE_ERROR_CODES.PENDING_EXPIRED,
          'Pending redemption has expired',
        );
      }
      // Re-read expires_at after lazy expire check (still pending).
      const refreshed = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        SELECT expires_at FROM redemption_requests
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${pending.id}::uuid
      `;
      return {
        kind: 'pending',
        pending: pendingBody(
          input,
          code,
          pending.id,
          operationId,
          refreshed[0]?.expires_at ?? pending.expires_at,
        ),
      };
    }
  }
  throw new IssueError(
    ISSUE_ERROR_CODES.CODE_DISABLED,
    'Redemption code is not available',
  );
}

/** Bind the code to one PENDING_REVIEW request. Does not allocate quota or insert a ticket. */
async function holdManualRedemption(
  tx: Prisma.TransactionClient,
  input: RedeemInput,
  code: CodeRow,
  operationId: string,
  consent: ConsentSnapshot,
  now: Date,
): Promise<IssueBusinessResult> {
  const sources = await tx.$queryRaw<
    Array<{ pending_ttl_hours: number; max_pending_per_user: number }>
  >`
    SELECT pending_ttl_hours, max_pending_per_user
    FROM issuance_sources
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${code.source_id}::uuid
  `;
  const source = sources[0];
  const ttlHours = source?.pending_ttl_hours ?? 24;
  const maxPending = source?.max_pending_per_user ?? 5;

  // Serialize pending-cap checks per actor/event via attendee row lock (no quota).
  const holdAttendeeId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO event_attendees (
      tenant_id, event_id, id, user_id, canonical_email, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${holdAttendeeId}::uuid,
      ${input.actorUserId}::uuid, ${input.actorEmail}, now(), now()
    )
    ON CONFLICT (tenant_id, event_id, user_id) DO NOTHING
  `;
  await tx.$queryRaw`
    SELECT id FROM event_attendees
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND user_id = ${input.actorUserId}::uuid
    FOR UPDATE
  `;

  const pendingCount = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND status = 'PENDING_REVIEW'
  `;
  if ((pendingCount[0]?.n ?? 0) >= maxPending) {
    throw new IssueError(
      ISSUE_ERROR_CODES.PENDING_LIMIT,
      'Pending redemption limit reached for this event',
    );
  }

  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  let requestId: string;
  try {
    const held = await holdCodeForReview(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      ownerUserId: input.actorUserId,
      codeId: code.id,
      formVersion: consent.formVersion,
      termsVersion: consent.termsVersion,
      answers: consent.answers,
      termsAccepted: consent.termsAccepted,
      consentAcceptedAt: consent.requiresConsentTimestamp ? now : null,
      formDefinitionHash: consent.formDefinitionHash,
      termsContentHash: consent.termsContentHash,
      expiresAt,
    });
    requestId = held.requestId;
  } catch (error) {
    if (error instanceof ApprovalError) {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_DISABLED,
        'Redemption code is not available',
      );
    }
    throw error;
  }
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid, 'redemption.pending', 'redemption_request',
      ${requestId}::uuid,
      ${JSON.stringify({
        codeId: code.id,
        sourceId: code.source_id,
        formVersion: consent.formVersion,
        termsVersion: consent.termsVersion,
        termsAccepted: consent.termsAccepted === true,
      })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;
  return {
    kind: 'pending',
    pending: pendingBody(input, code, requestId, operationId, expiresAt),
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

/** Parse COMPLETED operation response_json when it is a rejection envelope. */
export function storedRejectionFromResponse(
  response: Prisma.JsonValue | null,
): { code: IssueErrorCode; message: string; retryable: boolean } | null {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'code' in response &&
    typeof (response as { code: unknown }).code === 'string' &&
    !('ticketId' in response)
  ) {
    const body = response as {
      code: string;
      message?: string;
      retryable?: boolean;
    };
    if (body.code === APPROVAL_PENDING) return null;
    if (
      !(Object.values(ISSUE_ERROR_CODES) as string[]).includes(body.code)
    ) {
      return null;
    }
    return {
      code: body.code as IssueErrorCode,
      message: body.message ?? body.code,
      retryable: Boolean(body.retryable),
    };
  }
  return null;
}

/** Replay helper: if completed operation stored a rejection envelope, rethrow. */
export function throwIfStoredRejection(
  response: Prisma.JsonValue | null,
): void {
  const stored = storedRejectionFromResponse(response);
  if (stored) {
    throw new IssueError(stored.code, stored.message, stored.retryable);
  }
}

function pendingFromStored(
  response: Prisma.JsonValue | null,
): Omit<PendingApprovalResult, 'replayed'> | null {
  if (
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response) ||
    !('code' in response) ||
    (response as { code: unknown }).code !== APPROVAL_PENDING ||
    !('requestId' in response) ||
    typeof (response as { requestId: unknown }).requestId !== 'string'
  ) {
    return null;
  }
  const body = response as Omit<PendingApprovalResult, 'replayed'>;
  return {
    code: APPROVAL_PENDING,
    requestId: body.requestId,
    operationId: body.operationId,
    eventId: body.eventId,
    ticketTypeId: body.ticketTypeId,
    sourceId: body.sourceId,
    status: 'PENDING_REVIEW',
    expiresAt: body.expiresAt,
  };
}

/** Map RedeemOutcome to IssuedTicketResult or IssueError (call outside withTenant). */
export function unwrapRedeemOutcome(outcome: RedeemOutcome): IssuedTicketResult {
  if (outcome.ok === true) return outcome.result;
  if (outcome.ok === 'pending') {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_DISABLED,
      'Redemption is waiting for approval',
    );
  }
  throw new IssueError(
    outcome.rejection.code,
    outcome.rejection.message,
    false,
  );
}
