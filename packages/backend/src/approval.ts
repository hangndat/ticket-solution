import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { ApprovalError, APPROVAL_ERROR_CODES } from './approval-error';
import {
  assertOpenForIssuance,
  dbClock,
  lockEventPolicyForShare,
} from './event-policy';
import { requireTenantPermission } from './membership';
import { expirePendingRequest } from './pending-expiry';
import type { FormAnswerValue } from '@ticket/contracts';

export const APPROVE_COMMAND = 'redemption.approve' as const;
export const DENY_COMMAND = 'redemption.deny' as const;
const PERMISSION_REVIEW = 'redemption.approve';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApprovalDecision = 'approve' | 'deny';

export type HoldPendingInput = {
  tenantId: string;
  eventId: string;
  ownerUserId: string;
  codeId: string;
  formVersion?: string | null;
  termsVersion?: string | null;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: true | null;
  consentAcceptedAt?: Date | null;
  formDefinitionHash?: string | null;
  termsContentHash?: string | null;
  expiresAt?: Date | null;
};

export type DecideRedemptionInput = {
  tenantId: string;
  eventId: string;
  requestId: string;
  /** Staff actor. Not the attendee who holds the code. */
  actorUserId: string;
  decision: ApprovalDecision;
  idempotencyKey: string;
  reason?: string | null;
};

export type ApprovalResult = {
  decision: ApprovalDecision;
  requestId: string;
  status: 'ISSUED' | 'REJECTED';
  ticketId: string | null;
  operationId: string;
  ownerUserId: string;
  replayed: boolean;
};

export type ApprovalRejection = {
  code: (typeof APPROVAL_ERROR_CODES)[keyof typeof APPROVAL_ERROR_CODES];
  message: string;
  retryable: false;
  operationId: string;
};

export type ApprovalOutcome =
  | { ok: true; result: ApprovalResult }
  | { ok: false; rejection: ApprovalRejection };

type RequestRow = {
  id: string;
  status: string;
  actor_user_id: string;
  redemption_code_id: string;
};

type CodeRow = {
  id: string;
  source_id: string;
  ticket_type_id: string;
  status: string;
  active_request_id: string | null;
  entitlement_snapshot: Prisma.JsonValue;
};

type TicketRow = {
  id: string;
  state: string;
  credential_version: number;
  ticket_type_id: string;
  source_id: string;
};

type OperationRow = {
  id: string;
  request_hash: string;
  status: string;
  response_json: Prisma.JsonValue | null;
};

type QuotaRow = {
  id: string;
  scope: string;
  scope_id: string | null;
  capacity: number | null;
  allocated: number;
};

function decisionHash(input: DecideRedemptionInput): string {
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    eventId: input.eventId,
    requestId: input.requestId,
    decision: input.decision,
    reason: input.reason ?? null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function commandFor(decision: ApprovalDecision): string {
  return decision === 'approve' ? APPROVE_COMMAND : DENY_COMMAND;
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

function storedRejection(
  response: Prisma.JsonValue | null,
): Omit<ApprovalRejection, 'operationId'> | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return null;
  }
  const body = response as { code?: unknown; message?: unknown; retryable?: unknown };
  if (typeof body.code !== 'string' || typeof body.message !== 'string') {
    return null;
  }
  if (!Object.values(APPROVAL_ERROR_CODES).includes(body.code as ApprovalRejection['code'])) {
    return null;
  }
  return {
    code: body.code as ApprovalRejection['code'],
    message: body.message,
    retryable: false,
  };
}

/**
 * Hold an available code for manual review. Does not allocate quota.
 * PostgreSQL is the source of truth; Redis is not consulted.
 */
export async function holdCodeForReview(
  tx: Prisma.TransactionClient,
  input: HoldPendingInput,
): Promise<{ requestId: string; status: 'PENDING_REVIEW' }> {
  const requestId = randomUUID();
  const held = await tx.$executeRaw`
    UPDATE redemption_codes
    SET status = 'HELD',
        active_request_id = ${requestId}::uuid,
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.codeId}::uuid
      AND status = 'AVAILABLE'
  `;
  if (Number(held) !== 1) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.CODE_NOT_HELD,
      'Redemption code is not available to hold',
    );
  }
  await tx.$executeRaw`
    INSERT INTO redemption_requests (
      tenant_id, event_id, id, actor_user_id, redemption_code_id,
      status, form_version, terms_version, answers_json, terms_accepted,
      consent_accepted_at, form_definition_hash, terms_content_hash,
      expires_at, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${requestId}::uuid,
      ${input.ownerUserId}::uuid, ${input.codeId}::uuid, 'PENDING_REVIEW',
      ${input.formVersion ?? null}, ${input.termsVersion ?? null},
      ${JSON.stringify(input.answers ?? {})}::jsonb,
      ${input.termsAccepted ?? null},
      ${input.consentAcceptedAt ?? null},
      ${input.formDefinitionHash ?? null},
      ${input.termsContentHash ?? null},
      ${input.expiresAt ?? null},
      now(), now()
    )
  `;
  return { requestId, status: 'PENDING_REVIEW' };
}

/**
 * Approve or deny a pending redemption inside the caller's withTenant transaction.
 * Same decision replay returns the stored result. Issued tickets are inserted once
 * and never updated here. Quota is read and incremented only in PostgreSQL.
 */
export async function decideRedemption(
  tx: Prisma.TransactionClient,
  credentialKeyMaterial: string,
  input: DecideRedemptionInput,
): Promise<ApprovalOutcome> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_REVIEW,
    eventId: input.eventId,
  });

  const key = input.idempotencyKey?.trim();
  if (!key || !UUID.test(key)) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
    );
  }
  if (input.decision === 'deny') {
    const reason = input.reason?.trim() ?? '';
    if (!reason) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.REASON_REQUIRED,
        'Denial reason is required',
      );
    }
    if (reason.length > 500) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.REASON_TOO_LONG,
        'Denial reason must be at most 500 characters',
      );
    }
    input = { ...input, reason };
  } else if (input.reason != null && input.reason.length > 500) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.REASON_TOO_LONG,
      'Denial reason must be at most 500 characters',
    );
  }

  const requestHash = decisionHash(input);
  const operationId = randomUUID();
  const command = commandFor(input.decision);
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
      ${input.actorUserId}::uuid, ${command}, ${key},
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
      AND command = ${command}
      AND client_key = ${key}
    FOR UPDATE
  `;
  const op = ops[0];
  if (!op) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to claim idempotency operation',
      true,
    );
  }
  if (op.request_hash !== requestHash) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key was reused with a different request',
    );
  }
  if (op.status === 'COMPLETED') {
    const stored = storedRejection(op.response_json);
    if (stored) {
      return { ok: false, rejection: { ...stored, operationId: op.id } };
    }
    const body = op.response_json as ApprovalResult | null;
    if (!body || typeof body !== 'object' || !('requestId' in body)) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT,
        'Idempotent operation is still in progress',
        true,
      );
    }
    return { ok: true, result: { ...body, operationId: op.id, replayed: true } };
  }

  await tx.$executeRaw`SAVEPOINT approval_business`;
  try {
    const result = await applyDecision(tx, credentialKeyMaterial, input, op.id);
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify({ ...result, replayed: false })}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${op.id}::uuid
    `;
    await tx.$executeRaw`RELEASE SAVEPOINT approval_business`;
    return { ok: true, result: { ...result, replayed: false } };
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT approval_business`;
    if (error instanceof ApprovalError && !error.retryable) {
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
      await tx.$executeRaw`RELEASE SAVEPOINT approval_business`;
      return {
        ok: false,
        rejection: { ...rejectionPayload, operationId: op.id },
      };
    }
    throw error;
  }
}

export function unwrapApprovalOutcome(outcome: ApprovalOutcome): ApprovalResult {
  if (!outcome.ok) {
    throw new ApprovalError(
      outcome.rejection.code,
      outcome.rejection.message,
      outcome.rejection.retryable,
    );
  }
  return outcome.result;
}

async function applyDecision(
  tx: Prisma.TransactionClient,
  credentialKeyMaterial: string,
  input: DecideRedemptionInput,
  operationId: string,
): Promise<Omit<ApprovalResult, 'replayed'>> {
  // Peek without lock to learn code id; then lock event → code → request.
  const peeks = await tx.$queryRaw<RequestRow[]>`
    SELECT id, status, actor_user_id, redemption_code_id
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.requestId}::uuid
  `;
  const peek = peeks[0];
  if (!peek) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.REQUEST_NOT_FOUND,
      'Redemption request was not found',
    );
  }

  if (peek.status === 'ISSUED' || peek.status === 'REJECTED') {
    // Terminal outcomes: lock request alone for consistent read.
    const requests = await tx.$queryRaw<RequestRow[]>`
      SELECT id, status, actor_user_id, redemption_code_id
      FROM redemption_requests
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND id = ${input.requestId}::uuid
      FOR UPDATE
    `;
    const request = requests[0]!;
    if (request.status === 'ISSUED') {
      if (input.decision !== 'approve') {
        throw new ApprovalError(
          APPROVAL_ERROR_CODES.DECISION_CONFLICT,
          'Issued redemption cannot be denied',
        );
      }
      const existing = await loadIssuedTicket(tx, input.tenantId, request.id);
      return {
        decision: 'approve',
        requestId: request.id,
        status: 'ISSUED',
        ticketId: existing.id,
        operationId,
        ownerUserId: request.actor_user_id,
      };
    }
    if (request.status === 'REJECTED') {
      if (input.decision !== 'deny') {
        throw new ApprovalError(
          APPROVAL_ERROR_CODES.DECISION_CONFLICT,
          'Denied redemption cannot be approved',
        );
      }
      return {
        decision: 'deny',
        requestId: request.id,
        status: 'REJECTED',
        ticketId: null,
        operationId,
        ownerUserId: request.actor_user_id,
      };
    }
    if (request.status === 'EXPIRED') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.PENDING_EXPIRED,
        'Pending redemption has expired',
      );
    }
  }

  if (peek.status === 'EXPIRED') {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.PENDING_EXPIRED,
      'Pending redemption has expired',
    );
  }

  if (peek.status !== 'PENDING_REVIEW') {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Redemption is not waiting for review',
    );
  }

  // Lazy expiry before decision (same lock order as approve/deny).
  const expired = await expirePendingRequest(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    requestId: input.requestId,
    actorUserId: input.actorUserId,
  });
  if (expired.expired) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.PENDING_EXPIRED,
      'Pending redemption has expired',
    );
  }

  // Lock order: event → code → request (event already locked inside expire peek path;
  // re-take consistently for the decision mutation).
  await tx.$queryRaw`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
    FOR SHARE
  `;
  await tx.$queryRaw`
    SELECT id FROM redemption_codes
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${peek.redemption_code_id}::uuid
    FOR UPDATE
  `;
  const requests = await tx.$queryRaw<RequestRow[]>`
    SELECT id, status, actor_user_id, redemption_code_id
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.requestId}::uuid
    FOR UPDATE
  `;
  const request = requests[0];
  if (!request) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.REQUEST_NOT_FOUND,
      'Redemption request was not found',
    );
  }
  if (request.status === 'EXPIRED') {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.PENDING_EXPIRED,
      'Pending redemption has expired',
    );
  }
  if (request.status !== 'PENDING_REVIEW') {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Redemption is not waiting for review',
    );
  }

  if (input.decision === 'deny') {
    await denyPending(tx, input, request, operationId);
    return {
      decision: 'deny',
      requestId: request.id,
      status: 'REJECTED',
      ticketId: null,
      operationId,
      ownerUserId: request.actor_user_id,
    };
  }

  const ticketId = await approvePending(
    tx,
    credentialKeyMaterial,
    input,
    request,
    operationId,
  );
  return {
    decision: 'approve',
    requestId: request.id,
    status: 'ISSUED',
    ticketId,
    operationId,
    ownerUserId: request.actor_user_id,
  };
}

async function loadIssuedTicket(
  tx: Prisma.TransactionClient,
  tenantId: string,
  requestId: string,
): Promise<TicketRow> {
  const tickets = await tx.$queryRaw<TicketRow[]>`
    SELECT id, state, credential_version, ticket_type_id, source_id
    FROM tickets
    WHERE tenant_id = ${tenantId}::uuid
      AND request_id = ${requestId}::uuid
  `;
  const ticket = tickets[0];
  if (!ticket) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Issued redemption has no ticket',
    );
  }
  return ticket;
}

async function denyPending(
  tx: Prisma.TransactionClient,
  input: DecideRedemptionInput,
  request: RequestRow,
  operationId: string,
): Promise<void> {
  const codes = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM redemption_codes
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${request.redemption_code_id}::uuid
    FOR UPDATE
  `;
  const code = codes[0];
  if (!code) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.CODE_NOT_HELD,
      'Redemption code is missing',
    );
  }
  if (code.status === 'CONSUMED') {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Consumed code cannot be denied',
    );
  }
  if (code.status === 'HELD') {
    const released = await tx.$executeRaw`
      UPDATE redemption_codes
      SET status = 'AVAILABLE',
          active_request_id = NULL,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${code.id}::uuid
        AND status = 'HELD'
        AND active_request_id = ${request.id}::uuid
    `;
    if (Number(released) !== 1) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.CODE_NOT_HELD,
        'Redemption code is not held by this request',
      );
    }
  }
  const updated = await tx.$executeRaw`
    UPDATE redemption_requests
    SET status = 'REJECTED',
        decision_reason = ${input.reason ?? null},
        decided_at = clock_timestamp(),
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${request.id}::uuid
      AND status = 'PENDING_REVIEW'
  `;
  if (Number(updated) !== 1) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Redemption is not waiting for review',
    );
  }
  // Audit: reason + owner id only — never answers/PII payload.
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, reason, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid, 'redemption.denied', 'redemption_request',
      ${request.id}::uuid, ${input.reason ?? null},
      ${JSON.stringify({
        ownerUserId: request.actor_user_id,
        decision: 'deny',
      })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;
}

async function approvePending(
  tx: Prisma.TransactionClient,
  credentialKeyMaterial: string,
  input: DecideRedemptionInput,
  request: RequestRow,
  operationId: string,
): Promise<string> {
  const event = await lockEventPolicyForShare(
    tx,
    input.tenantId,
    input.eventId,
  );
  const now = await dbClock(tx);
  assertOpenForIssuance(event, now, 'approval');

  // Code should already be locked by applyDecision; re-lock is same-tx safe.
  const codes = await tx.$queryRaw<CodeRow[]>`
    SELECT c.id, c.source_id, c.ticket_type_id, c.status, c.active_request_id,
           t.entitlement_snapshot
    FROM redemption_codes c
    JOIN ticket_types t
      ON t.tenant_id = c.tenant_id AND t.id = c.ticket_type_id
    WHERE c.tenant_id = ${input.tenantId}::uuid
      AND c.id = ${request.redemption_code_id}::uuid
    FOR UPDATE OF c
  `;
  const code = codes[0];
  if (
    !code ||
    code.status !== 'HELD' ||
    code.active_request_id !== request.id
  ) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.CODE_NOT_HELD,
      'Redemption code is not held for this request',
    );
  }

  const owners = await tx.$queryRaw<Array<{ email: string | null }>>`
    SELECT email FROM users WHERE id = ${request.actor_user_id}::uuid
  `;
  const ownerEmail = owners[0]?.email ?? null;

  const attendeeId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO event_attendees (
      tenant_id, event_id, id, user_id, canonical_email, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${attendeeId}::uuid,
      ${request.actor_user_id}::uuid, ${ownerEmail}, now(), now()
    )
    ON CONFLICT (tenant_id, event_id, user_id) DO NOTHING
  `;
  const attendees = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM event_attendees
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND user_id = ${request.actor_user_id}::uuid
  `;
  const attendee = attendees[0];
  if (!attendee) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT,
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
  const counters = await tx.$queryRaw<
    Array<{ issued_count: number; max_tickets: number | null }>
  >`
    SELECT issued_count, max_tickets
    FROM attendee_counters
    WHERE tenant_id = ${input.tenantId}::uuid
      AND attendee_id = ${attendee.id}::uuid
    FOR UPDATE
  `;
  const counter = counters[0];
  if (!counter) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to lock attendee counter',
      true,
    );
  }
  if (counter.max_tickets !== null && counter.issued_count >= counter.max_tickets) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.ATTENDEE_LIMIT,
      'Attendee ticket limit reached',
    );
  }

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
    const delta = scopeOrder(a.scope) - scopeOrder(b.scope);
    if (delta !== 0) return delta;
    return (a.scope_id ?? '').localeCompare(b.scope_id ?? '');
  });
  if (quotas.length < 1) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.QUOTA_EXHAUSTED,
      'No quota buckets configured for this event',
    );
  }
  for (const bucket of quotas) {
    if (bucket.capacity !== null && bucket.allocated >= bucket.capacity) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.QUOTA_EXHAUSTED,
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
    if (Number(updated) !== 1) {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.QUOTA_EXHAUSTED,
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

  const consumed = await tx.$executeRaw`
    UPDATE redemption_codes
    SET status = 'CONSUMED', updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${code.id}::uuid
      AND status = 'HELD'
      AND active_request_id = ${request.id}::uuid
  `;
  if (Number(consumed) !== 1) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.CODE_NOT_HELD,
      'Redemption code is not held for this request',
    );
  }
  const issued = await tx.$executeRaw`
    UPDATE redemption_requests
    SET status = 'ISSUED',
        decided_at = ${now},
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${request.id}::uuid
      AND status = 'PENDING_REVIEW'
  `;
  if (Number(issued) !== 1) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.DECISION_CONFLICT,
      'Redemption is not waiting for review',
    );
  }

  const ticketId = randomUUID();
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
      ${request.actor_user_id}::uuid, ${code.ticket_type_id}::uuid,
      ${code.source_id}::uuid, ${request.id}::uuid, ${code.id}::uuid,
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

  const outboxId = randomUUID();
  const notificationId = randomUUID();
  const outboxPayload = {
    ticketId,
    requestId: request.id,
    ownerUserId: request.actor_user_id,
    email: ownerEmail,
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
  await tx.$executeRaw`
    INSERT INTO notifications (
      tenant_id, event_id, id, business_key, channel, kind, payload_version,
      state, attempts, payload, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${notificationId}::uuid,
      ${`ticket:${ticketId}:issued:email`}, 'email', 'TicketIssued', 1,
      'PENDING', 0,
      ${JSON.stringify(outboxPayload)}::jsonb, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid, 'redemption.approved', 'redemption_request',
      ${request.id}::uuid,
      ${JSON.stringify({
        ownerUserId: request.actor_user_id,
        ticketId,
        decision: 'approve',
      })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;
  return ticketId;
}
