/**
 * Pending redemption expiry — lazy + worker share this primitive.
 * Lock order: event → code → request (matches approve/deny/resume).
 * Deny/expiry release code to AVAILABLE; issued/CONSUMED codes are never reopened.
 */

import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { ApprovalError, APPROVAL_ERROR_CODES } from './approval-error';

export type ExpirePendingResult =
  | { expired: true; requestId: string; codeId: string }
  | { expired: false; reason: 'not_pending' | 'not_due' | 'not_found' };

type RequestPeek = {
  id: string;
  status: string;
  redemption_code_id: string;
  expires_at: Date | null;
  actor_user_id: string;
};

/**
 * Expire one PENDING_REVIEW request if due (or force). Releases HELD code.
 * Caller must already hold the idempotency operation lock when racing approve.
 */
export async function expirePendingRequest(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    requestId: string;
    /** When true, expire even if expires_at is in the future (tests). */
    force?: boolean;
    actorUserId?: string | null;
  },
): Promise<ExpirePendingResult> {
  const peeks = await tx.$queryRaw<RequestPeek[]>`
    SELECT id, status, redemption_code_id, expires_at, actor_user_id
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.requestId}::uuid
  `;
  const peek = peeks[0];
  if (!peek) return { expired: false, reason: 'not_found' };
  if (peek.status !== 'PENDING_REVIEW') {
    return { expired: false, reason: 'not_pending' };
  }

  // Lock order: event → code → request
  await tx.$queryRaw`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
    FOR SHARE
  `;

  const codes = await tx.$queryRaw<
    Array<{ id: string; status: string; active_request_id: string | null }>
  >`
    SELECT id, status, active_request_id
    FROM redemption_codes
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${peek.redemption_code_id}::uuid
    FOR UPDATE
  `;
  const code = codes[0];
  if (!code) {
    throw new ApprovalError(
      APPROVAL_ERROR_CODES.CODE_NOT_HELD,
      'Redemption code is missing',
    );
  }

  const requests = await tx.$queryRaw<RequestPeek[]>`
    SELECT id, status, redemption_code_id, expires_at, actor_user_id
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.requestId}::uuid
    FOR UPDATE
  `;
  const request = requests[0];
  if (!request || request.status !== 'PENDING_REVIEW') {
    return { expired: false, reason: 'not_pending' };
  }

  const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  const now = nowRows[0]?.now ?? new Date();
  if (
    !input.force &&
    (request.expires_at == null || request.expires_at > now)
  ) {
    return { expired: false, reason: 'not_due' };
  }

  if (code.status === 'HELD' && code.active_request_id === request.id) {
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
  } else if (code.status === 'CONSUMED') {
    // Issued path won the race — do not reopen.
    return { expired: false, reason: 'not_pending' };
  }

  const updated = await tx.$executeRaw`
    UPDATE redemption_requests
    SET status = 'EXPIRED',
        decided_at = ${now},
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${request.id}::uuid
      AND status = 'PENDING_REVIEW'
  `;
  if (Number(updated) !== 1) {
    return { expired: false, reason: 'not_pending' };
  }

  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
      ${input.actorUserId ?? null}, 'redemption.expired', 'redemption_request',
      ${request.id}::uuid,
      ${JSON.stringify({
        codeId: code.id,
        ownerUserId: request.actor_user_id,
      })}::jsonb,
      now()
    )
  `;

  return { expired: true, requestId: request.id, codeId: code.id };
}

/**
 * Worker/lazy batch: expire due PENDING_REVIEW rows (deterministic id order).
 * Processes one tenant/event candidate list without holding locks across events.
 */
export async function expireDuePendingBatch(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; eventId?: string; limit?: number },
): Promise<{ expired: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const candidates = input.eventId
    ? await tx.$queryRaw<Array<{ id: string; event_id: string }>>`
        SELECT id, event_id
        FROM redemption_requests
        WHERE tenant_id = ${input.tenantId}::uuid
          AND event_id = ${input.eventId}::uuid
          AND status = 'PENDING_REVIEW'
          AND expires_at IS NOT NULL
          AND expires_at <= clock_timestamp()
        ORDER BY expires_at ASC, id ASC
        LIMIT ${limit}
      `
    : await tx.$queryRaw<Array<{ id: string; event_id: string }>>`
        SELECT id, event_id
        FROM redemption_requests
        WHERE tenant_id = ${input.tenantId}::uuid
          AND status = 'PENDING_REVIEW'
          AND expires_at IS NOT NULL
          AND expires_at <= clock_timestamp()
        ORDER BY expires_at ASC, id ASC
        LIMIT ${limit}
      `;

  let expired = 0;
  for (const row of candidates) {
    const result = await expirePendingRequest(tx, {
      tenantId: input.tenantId,
      eventId: row.event_id,
      requestId: row.id,
    });
    if (result.expired) expired += 1;
  }
  return { expired };
}

/**
 * Cross-tenant worker sweep using a SECURITY-safe app connection that sets
 * tenant context per row. Prefer calling expireDuePendingBatch inside withTenant.
 */
export async function listDuePendingTenants(
  tx: Prisma.TransactionClient,
  limit = 50,
): Promise<Array<{ tenant_id: string; event_id: string; id: string }>> {
  const capped = Math.min(Math.max(limit, 1), 200);
  return tx.$queryRaw<
    Array<{ tenant_id: string; event_id: string; id: string }>
  >`
    SELECT tenant_id, event_id, id
    FROM redemption_requests
    WHERE status = 'PENDING_REVIEW'
      AND expires_at IS NOT NULL
      AND expires_at <= clock_timestamp()
    ORDER BY expires_at ASC, id ASC
    LIMIT ${capped}
  `;
}
