import type { Prisma } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import { ReportError, REPORT_ERROR_CODES } from './report-error';

const PERMISSION_REPORT = 'report.read';

type TicketState = 'ACTIVE' | 'REVOKED' | 'CANCELLED' | 'USED';

export type TicketStateCounts = Record<TicketState, number>;

export type EventReport = {
  eventId: string;
  ticketsByState: TicketStateCounts;
  quota: { capacity: number | null; allocated: number };
  pendingApprovalCount: number;
};

function emptyCounts(): TicketStateCounts {
  return { ACTIVE: 0, REVOKED: 0, CANCELLED: 0, USED: 0 };
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const quota = quotaRows[0];

  const pendingRows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM redemption_requests
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND status = 'PENDING_REVIEW'
  `;

  return {
    eventId: input.eventId,
    ticketsByState,
    quota: {
      capacity: quota
        ? quota.capacity === null
          ? null
          : asCount(quota.capacity)
        : null,
      allocated: quota ? asCount(quota.allocated) : 0,
    },
    pendingApprovalCount: asCount(pendingRows[0]?.n),
  };
}
