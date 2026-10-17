import type { Prisma } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import { ReportError, REPORT_ERROR_CODES } from './report-error';

const PERMISSION_REPORT = 'report.read';

/** Audit action written when Gate denies a scan/confirm (O12 rejectByReason). */
export const GATE_REJECT_AUDIT_ACTION = 'gate.reject';

type TicketState = 'ACTIVE' | 'REVOKED' | 'CANCELLED' | 'USED';

export type TicketStateCounts = Record<TicketState, number>;

/**
 * O12 quota semantics for remaining seats.
 * - FINITE: capacity is a number; remaining = max(0, capacity - allocated)
 * - UNLIMITED: EVENT bucket exists with capacity NULL → remaining is null (not 0)
 * - MISSING_BUCKET: no EVENT quota row → remaining is null (not 0)
 */
export type QuotaCapacityState = 'FINITE' | 'UNLIMITED' | 'MISSING_BUCKET';

export type EventReport = {
  eventId: string;
  ticketsByState: TicketStateCounts;
  quota: { capacity: number | null; allocated: number };
  /** Remaining when FINITE; null for UNLIMITED / MISSING_BUCKET (never a fake 0). */
  quotaRemaining: number | null;
  quotaCapacityState: QuotaCapacityState;
  pendingApprovalCount: number;
  /**
   * Current successful Gate admits: rows in `checkins` with undone_at IS NULL.
   * Not equal to tickets.state=USED when Supervisor undo restored ACTIVE.
   */
  checkInSuccessCount: number;
  /** Counts of Gate rejects keyed by stable reason/code (audit `gate.reject`). */
  rejectByReason: Record<string, number>;
  /**
   * Email notifications that need CS: terminal DEAD from delivery exhaustion.
   * Temporary FAILED (retry scheduled) and DEAD from ticket revoke/cancel are excluded.
   */
  emailNeedsCsCount: number;
  /** Server clock watermark for this snapshot (ISO-8601). */
  asOf: string;
};

function emptyCounts(): TicketStateCounts {
  return { ACTIVE: 0, REVOKED: 0, CANCELLED: 0, USED: 0 };
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveQuota(input: {
  bucket: { capacity: number | null; allocated: number } | undefined;
}): {
  quota: { capacity: number | null; allocated: number };
  quotaRemaining: number | null;
  quotaCapacityState: QuotaCapacityState;
} {
  if (!input.bucket) {
    return {
      quota: { capacity: null, allocated: 0 },
      quotaRemaining: null,
      quotaCapacityState: 'MISSING_BUCKET',
    };
  }
  const allocated = asCount(input.bucket.allocated);
  if (input.bucket.capacity === null) {
    return {
      quota: { capacity: null, allocated },
      quotaRemaining: null,
      quotaCapacityState: 'UNLIMITED',
    };
  }
  const capacity = asCount(input.bucket.capacity);
  return {
    quota: { capacity, allocated },
    quotaRemaining: Math.max(0, capacity - allocated),
    quotaCapacityState: 'FINITE',
  };
}

/**
 * Read-only event summary. Counts only — no attendee email, code, or export.
 * Must run inside withTenant. Requires report.read on the event assignment.
 */
export async function readEventReport(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; eventId: string; actorUserId: string },
): Promise<EventReport> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_REPORT,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new ReportError(
      REPORT_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }

  const asOfRows = await tx.$queryRaw<{ as_of: Date }[]>`
    SELECT clock_timestamp() AS as_of
  `;
  const asOf = (asOfRows[0]?.as_of ?? new Date()).toISOString();

  const stateRows = await tx.$queryRaw<{ state: string; n: number }[]>`
    SELECT state, COUNT(*)::int AS n
    FROM tickets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
    GROUP BY state
  `;
  const ticketsByState = emptyCounts();
  for (const row of stateRows) {
    if (row.state in ticketsByState) {
      ticketsByState[row.state as keyof TicketStateCounts] = asCount(row.n);
    }
  }

  const quotaRows = await tx.$queryRaw<
    { capacity: number | null; allocated: number }[]
  >`
    SELECT capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND scope = 'EVENT'
  `;
  const resolvedQuota = resolveQuota({ bucket: quotaRows[0] });

  const pendingRows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND status = 'PENDING_REVIEW'
  `;

  const checkInRows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM checkins
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND undone_at IS NULL
  `;

  const rejectRows = await tx.$queryRaw<{ reason: string; n: number }[]>`
    SELECT COALESCE(NULLIF(TRIM(reason), ''), 'UNKNOWN') AS reason,
           COUNT(*)::int AS n
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND action = ${GATE_REJECT_AUDIT_ACTION}
    GROUP BY 1
  `;
  const rejectByReason: Record<string, number> = {};
  for (const row of rejectRows) {
    rejectByReason[row.reason] = asCount(row.n);
  }

  const emailCsRows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM notifications
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND channel = 'email'
      AND state = 'DEAD'
      AND COALESCE(last_error, '') <> 'ticket revoked/cancelled'
  `;

  return {
    eventId: input.eventId,
    ticketsByState,
    quota: resolvedQuota.quota,
    quotaRemaining: resolvedQuota.quotaRemaining,
    quotaCapacityState: resolvedQuota.quotaCapacityState,
    pendingApprovalCount: asCount(pendingRows[0]?.n),
    checkInSuccessCount: asCount(checkInRows[0]?.n),
    rejectByReason,
    emailNeedsCsCount: asCount(emailCsRows[0]?.n),
    asOf,
  };
}
