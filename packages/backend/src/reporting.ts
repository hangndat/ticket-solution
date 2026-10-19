import type { Prisma } from './generated/prisma/client';
import {
  lockActiveMembershipForShare,
  requireTenantPermission,
} from './membership';
import { ReportError, REPORT_ERROR_CODES } from './report-error';

const PERMISSION_REPORT = 'report.read';

/** Audit action written when Gate denies a scan/confirm (O12 rejectByReason). */
export const GATE_REJECT_AUDIT_ACTION = 'gate.reject';

/**
 * Portfolio page budget (PORTAL-P2-ADR §4.3 / O03).
 * Tighter than shared CURSOR_PAGE_LIMIT.max (100).
 */
export const PORTFOLIO_PAGE_LIMIT = {
  min: 1,
  max: 50,
  default: 20,
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** One event row in multi-event portfolio (O12 dictionary subset; no PII). */
export type PortfolioReportItem = {
  eventId: string;
  /** Event display name (events.name). */
  title: string;
  checkInSuccessCount: number;
  pendingApprovalCount: number;
  emailNeedsCsCount: number;
  quotaRemaining: number | null;
  quotaCapacityState: QuotaCapacityState;
  /** Gate rejects by stable reason — O12; no attendee PII. */
  rejectByReason: Record<string, number>;
};

export type PortfolioReport = {
  /** Single server watermark for the whole response (ISO-8601). */
  asOf: string;
  items: PortfolioReportItem[];
  nextCursor: string | null;
  /** Effective limit after clamp (default 20, hard max 50). */
  limit: number;
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

function clampPortfolioLimit(limit?: number): number {
  const n =
    typeof limit === 'number' && Number.isFinite(limit)
      ? limit
      : PORTFOLIO_PAGE_LIMIT.default;
  return Math.min(
    Math.max(Math.floor(n), PORTFOLIO_PAGE_LIMIT.min),
    PORTFOLIO_PAGE_LIMIT.max,
  );
}

function encodePortfolioCursor(eventId: string): string {
  return Buffer.from(JSON.stringify({ id: eventId }), 'utf8').toString(
    'base64url',
  );
}

function decodePortfolioCursor(cursor: string | undefined): string | null {
  if (cursor === undefined || cursor === null) return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  try {
    const raw = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (typeof parsed.id !== 'string' || !UUID_RE.test(parsed.id)) {
      throw new ReportError(
        REPORT_ERROR_CODES.INVALID_CURSOR,
        'Invalid cursor',
      );
    }
    return parsed.id;
  } catch (error) {
    if (error instanceof ReportError) throw error;
    throw new ReportError(
      REPORT_ERROR_CODES.INVALID_CURSOR,
      'Invalid cursor',
    );
  }
}

/**
 * Multi-event Owner portfolio (PORTAL-P2-ADR §4.3 / O17).
 * Requires ACTIVE tenant membership. Each item requires event assignment with
 * report.read — events without that grant are omitted (not 403).
 * One asOf watermark for the whole response. Counts only — no PII.
 */
export async function readPortfolioReport(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
  },
): Promise<PortfolioReport> {
  const membership = await lockActiveMembershipForShare(
    tx,
    input.tenantId,
    input.actorUserId,
  );

  const limit = clampPortfolioLimit(input.limit);
  const cursorId = decodePortfolioCursor(input.cursor);

  const asOfRows = await tx.$queryRaw<{ as_of: Date }[]>`
    SELECT clock_timestamp() AS as_of
  `;
  const asOf = (asOfRows[0]?.as_of ?? new Date()).toISOString();

  type EventRow = { id: string; name: string };
  const eventRows = cursorId
    ? await tx.$queryRaw<EventRow[]>`
        SELECT e.id, e.name
        FROM events e
        INNER JOIN event_assignments ea
          ON ea.tenant_id = e.tenant_id
         AND ea.event_id = e.id
        WHERE e.tenant_id = ${input.tenantId}::uuid
          AND ea.membership_id = ${membership.membershipId}::uuid
          AND ea.revoked_at IS NULL
          AND ea.activated_at IS NOT NULL
          AND ea.activated_at <= clock_timestamp()
          AND ${PERMISSION_REPORT} = ANY(ea.permissions)
          AND e.id > ${cursorId}::uuid
        ORDER BY e.id ASC
        LIMIT ${limit + 1}
      `
    : await tx.$queryRaw<EventRow[]>`
        SELECT e.id, e.name
        FROM events e
        INNER JOIN event_assignments ea
          ON ea.tenant_id = e.tenant_id
         AND ea.event_id = e.id
        WHERE e.tenant_id = ${input.tenantId}::uuid
          AND ea.membership_id = ${membership.membershipId}::uuid
          AND ea.revoked_at IS NULL
          AND ea.activated_at IS NOT NULL
          AND ea.activated_at <= clock_timestamp()
          AND ${PERMISSION_REPORT} = ANY(ea.permissions)
        ORDER BY e.id ASC
        LIMIT ${limit + 1}
      `;

  const page = eventRows.slice(0, limit);
  const nextCursor =
    eventRows.length > limit && page[page.length - 1]
      ? encodePortfolioCursor(page[page.length - 1]!.id)
      : null;

  if (page.length === 0) {
    return { asOf, items: [], nextCursor: null, limit };
  }

  const eventIds = page.map((row) => row.id);

  const pendingRows = await tx.$queryRaw<{ event_id: string; n: number }[]>`
    SELECT event_id, COUNT(*)::int AS n
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND status = 'PENDING_REVIEW'
    GROUP BY event_id
  `;
  const pendingByEvent = new Map(
    pendingRows.map((row) => [row.event_id, asCount(row.n)]),
  );

  const checkInRows = await tx.$queryRaw<{ event_id: string; n: number }[]>`
    SELECT event_id, COUNT(*)::int AS n
    FROM checkins
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND undone_at IS NULL
    GROUP BY event_id
  `;
  const checkInByEvent = new Map(
    checkInRows.map((row) => [row.event_id, asCount(row.n)]),
  );

  const emailCsRows = await tx.$queryRaw<{ event_id: string; n: number }[]>`
    SELECT event_id, COUNT(*)::int AS n
    FROM notifications
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND channel = 'email'
      AND state = 'DEAD'
      AND COALESCE(last_error, '') <> 'ticket revoked/cancelled'
    GROUP BY event_id
  `;
  const emailCsByEvent = new Map(
    emailCsRows.map((row) => [row.event_id, asCount(row.n)]),
  );

  const quotaRows = await tx.$queryRaw<
    { event_id: string; capacity: number | null; allocated: number }[]
  >`
    SELECT event_id, capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND scope = 'EVENT'
  `;
  const quotaByEvent = new Map(
    quotaRows.map((row) => [
      row.event_id,
      resolveQuota({
        bucket: { capacity: row.capacity, allocated: row.allocated },
      }),
    ]),
  );

  const rejectRows = await tx.$queryRaw<
    { event_id: string; reason: string; n: number }[]
  >`
    SELECT event_id,
           COALESCE(NULLIF(TRIM(reason), ''), 'UNKNOWN') AS reason,
           COUNT(*)::int AS n
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND action = ${GATE_REJECT_AUDIT_ACTION}
    GROUP BY event_id, 2
  `;
  const rejectByEvent = new Map<string, Record<string, number>>();
  for (const row of rejectRows) {
    const bucket = rejectByEvent.get(row.event_id) ?? {};
    bucket[row.reason] = asCount(row.n);
    rejectByEvent.set(row.event_id, bucket);
  }

  const items: PortfolioReportItem[] = page.map((row) => {
    const quota = quotaByEvent.get(row.id) ?? resolveQuota({ bucket: undefined });
    return {
      eventId: row.id,
      title: row.name,
      checkInSuccessCount: checkInByEvent.get(row.id) ?? 0,
      pendingApprovalCount: pendingByEvent.get(row.id) ?? 0,
      emailNeedsCsCount: emailCsByEvent.get(row.id) ?? 0,
      quotaRemaining: quota.quotaRemaining,
      quotaCapacityState: quota.quotaCapacityState,
      rejectByReason: rejectByEvent.get(row.id) ?? {},
    };
  });

  return { asOf, items, nextCursor, limit };
}
