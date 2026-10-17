/**
 * Owner current-status + staff pending cursor list (C-F).
 * Operations are receipts; these queries return live business state.
 */

import type { Prisma } from './generated/prisma/client';
import {
  CURSOR_PAGE_LIMIT,
  type OwnerRedemptionStatus,
  type StaffPendingRedemptionItem,
  type StaffPendingRedemptionPage,
} from '@ticket/contracts';
import { requireTenantPermission } from './membership';
import { IssueError, ISSUE_ERROR_CODES } from './issue-error';
import { expirePendingRequest } from './pending-expiry';

function maskEmail(email: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  const head = local.slice(0, 1) || '*';
  return `${head}***@${domain}`;
}

function decodeCursor(cursor: string | undefined): {
  createdAt: string;
  id: string;
} | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    'utf8',
  ).toString('base64url');
}

/**
 * Owner-only live status. Lazily expires due pending before returning EXPIRED.
 */
export async function getOwnerRedemptionStatus(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    requestId: string;
    ownerUserId: string;
  },
): Promise<OwnerRedemptionStatus> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      event_id: string;
      status: string;
      expires_at: Date | null;
      created_at: Date;
      decided_at: Date | null;
      decision_reason: string | null;
      updated_at: Date;
      ticket_type_id: string;
      source_id: string;
      ticket_id: string | null;
      ticket_created_at: Date | null;
    }>
  >`
    SELECT r.id, r.event_id, r.status, r.expires_at, r.created_at,
           r.decided_at, r.decision_reason, r.updated_at,
           c.ticket_type_id, c.source_id,
           t.id AS ticket_id, t.created_at AS ticket_created_at
    FROM redemption_requests r
    JOIN redemption_codes c
      ON c.tenant_id = r.tenant_id AND c.id = r.redemption_code_id
    LEFT JOIN tickets t
      ON t.tenant_id = r.tenant_id AND t.request_id = r.id
    WHERE r.tenant_id = ${input.tenantId}::uuid
      AND r.id = ${input.requestId}::uuid
      AND r.actor_user_id = ${input.ownerUserId}::uuid
  `;
  const row = rows[0];
  if (!row) {
    throw new IssueError(
      ISSUE_ERROR_CODES.REDEMPTION_NOT_FOUND,
      'Redemption request was not found',
    );
  }

  if (row.status === 'PENDING_REVIEW') {
    const expired = await expirePendingRequest(tx, {
      tenantId: input.tenantId,
      eventId: row.event_id,
      requestId: row.id,
    });
    if (expired.expired) {
      const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS now
      `;
      return {
        status: 'EXPIRED',
        requestId: row.id,
        eventId: row.event_id,
        ticketTypeId: row.ticket_type_id,
        sourceId: row.source_id,
        expiredAt: (nowRows[0]?.now ?? new Date()).toISOString(),
      };
    }
    return {
      status: 'PENDING_REVIEW',
      requestId: row.id,
      eventId: row.event_id,
      ticketTypeId: row.ticket_type_id,
      sourceId: row.source_id,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      submittedAt: row.created_at.toISOString(),
    };
  }

  if (row.status === 'ISSUED') {
    if (!row.ticket_id) {
      throw new IssueError(
        ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
        'Issued redemption is missing ticket',
        true,
      );
    }
    return {
      status: 'ISSUED',
      requestId: row.id,
      eventId: row.event_id,
      ticketId: row.ticket_id,
      ticketTypeId: row.ticket_type_id,
      sourceId: row.source_id,
      issuedAt: (row.ticket_created_at ?? row.updated_at).toISOString(),
    };
  }

  if (row.status === 'REJECTED') {
    return {
      status: 'REJECTED',
      requestId: row.id,
      eventId: row.event_id,
      ticketTypeId: row.ticket_type_id,
      sourceId: row.source_id,
      reason: row.decision_reason,
      decidedAt: (row.decided_at ?? row.updated_at).toISOString(),
    };
  }

  if (row.status === 'EXPIRED') {
    return {
      status: 'EXPIRED',
      requestId: row.id,
      eventId: row.event_id,
      ticketTypeId: row.ticket_type_id,
      sourceId: row.source_id,
      expiredAt: (row.decided_at ?? row.updated_at).toISOString(),
    };
  }

  throw new IssueError(
    ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
    'Unknown redemption status',
    true,
  );
}

/**
 * Staff pending list — requires redemption.approve. Masked actor email only.
 */
export async function listStaffPendingRedemptions(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
  },
): Promise<StaffPendingRedemptionPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: 'redemption.approve',
    eventId: input.eventId,
  });

  const limit = Math.min(
    Math.max(input.limit ?? CURSOR_PAGE_LIMIT.default, CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
  const cursor = decodeCursor(input.cursor);

  const rows = cursor
    ? await tx.$queryRaw<
        Array<{
          id: string;
          event_id: string;
          expires_at: Date | null;
          created_at: Date;
          ticket_type_id: string;
          source_id: string;
          email: string | null;
        }>
      >`
        SELECT r.id, r.event_id, r.expires_at, r.created_at,
               c.ticket_type_id, c.source_id, u.email
        FROM redemption_requests r
        JOIN redemption_codes c
          ON c.tenant_id = r.tenant_id AND c.id = r.redemption_code_id
        JOIN users u ON u.id = r.actor_user_id
        WHERE r.tenant_id = ${input.tenantId}::uuid
          AND r.event_id = ${input.eventId}::uuid
          AND r.status = 'PENDING_REVIEW'
          AND (
            r.created_at > ${cursor.createdAt}::timestamptz
            OR (r.created_at = ${cursor.createdAt}::timestamptz AND r.id > ${cursor.id}::uuid)
          )
        ORDER BY r.created_at ASC, r.id ASC
        LIMIT ${limit + 1}
      `
    : await tx.$queryRaw<
        Array<{
          id: string;
          event_id: string;
          expires_at: Date | null;
          created_at: Date;
          ticket_type_id: string;
          source_id: string;
          email: string | null;
        }>
      >`
        SELECT r.id, r.event_id, r.expires_at, r.created_at,
               c.ticket_type_id, c.source_id, u.email
        FROM redemption_requests r
        JOIN redemption_codes c
          ON c.tenant_id = r.tenant_id AND c.id = r.redemption_code_id
        JOIN users u ON u.id = r.actor_user_id
        WHERE r.tenant_id = ${input.tenantId}::uuid
          AND r.event_id = ${input.eventId}::uuid
          AND r.status = 'PENDING_REVIEW'
        ORDER BY r.created_at ASC, r.id ASC
        LIMIT ${limit + 1}
      `;

  const page = rows.slice(0, limit);
  const items: StaffPendingRedemptionItem[] = page.map((row) => ({
    requestId: row.id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    sourceId: row.source_id,
    status: 'PENDING_REVIEW' as const,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    submittedAt: row.created_at.toISOString(),
    actorEmailMasked: maskEmail(row.email),
  }));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor(last.created_at, last.id)
      : null;
  return { items, nextCursor };
}
