import type { Prisma } from './generated/prisma/client';
import { ApprovalError, APPROVAL_ERROR_CODES } from './approval-error';
import { GateError, GATE_ERROR_CODES } from './gate-error';
import { IssueError, ISSUE_ERROR_CODES } from './issue-error';

export type EventPolicyRow = {
  id: string;
  status: string;
  content_status: string;
  business_status: string;
  redemption_opens_at: Date | null;
  redemption_closes_at: Date | null;
  check_in_opens_at: Date | null;
  check_in_closes_at: Date | null;
  max_tickets_per_attendee: number | null;
};

/** Half-open [opensAt, closesAt); null bound = unbounded on that side. DB clock after lock. */
export function isWindowOpen(
  now: Date,
  opensAt: Date | null,
  closesAt: Date | null,
): boolean {
  if (opensAt && now < opensAt) return false;
  if (closesAt && now >= closesAt) return false;
  return true;
}

/**
 * Outbox kinds the worker can process today. Do not enqueue unsupported kinds
 * (they become DEAD). EventChanged/EventCancelled wait for N2 handlers.
 */
export const SUPPORTED_OUTBOX_KINDS = new Set(['TicketIssued']);

export function canEnqueueOutboxKind(kind: string): boolean {
  return SUPPORTED_OUTBOX_KINDS.has(kind);
}

export async function lockEventPolicyForShare(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<EventPolicyRow | undefined> {
  const rows = await tx.$queryRaw<EventPolicyRow[]>`
    SELECT id, status, content_status, business_status,
           redemption_opens_at, redemption_closes_at,
           check_in_opens_at, check_in_closes_at,
           max_tickets_per_attendee
    FROM events
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${eventId}::uuid
    FOR SHARE
  `;
  return rows[0];
}

export async function dbClock(
  tx: Prisma.TransactionClient,
): Promise<Date> {
  const rows = await tx.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp() AS now
  `;
  return rows[0]?.now ?? new Date();
}

/** Issue / approve: PUBLISHED content + ACTIVE business + redemption window. */
export function assertOpenForIssuance(
  event: EventPolicyRow | undefined,
  now: Date,
  surface: 'issue' | 'approval',
): asserts event is EventPolicyRow {
  if (!event) {
    if (surface === 'approval') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.EVENT_CLOSED,
        'Event is not open for redemption',
      );
    }
    throw new IssueError(
      ISSUE_ERROR_CODES.EVENT_CLOSED,
      'Event is not open for redemption',
    );
  }
  if (event.business_status === 'CANCELLED') {
    if (surface === 'approval') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.EVENT_CANCELLED,
        'Event is cancelled',
      );
    }
    throw new IssueError(
      ISSUE_ERROR_CODES.EVENT_CANCELLED,
      'Event is cancelled',
    );
  }
  if (event.content_status === 'ARCHIVED' || event.status === 'ARCHIVED') {
    if (surface === 'approval') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.EVENT_ARCHIVED,
        'Event is archived',
      );
    }
    throw new IssueError(
      ISSUE_ERROR_CODES.EVENT_ARCHIVED,
      'Event is archived',
    );
  }
  if (event.content_status !== 'PUBLISHED' && event.status !== 'PUBLISHED') {
    if (surface === 'approval') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.EVENT_CLOSED,
        'Event is not open for redemption',
      );
    }
    throw new IssueError(
      ISSUE_ERROR_CODES.EVENT_CLOSED,
      'Event is not open for redemption',
    );
  }
  if (
    !isWindowOpen(now, event.redemption_opens_at, event.redemption_closes_at)
  ) {
    if (surface === 'approval') {
      throw new ApprovalError(
        APPROVAL_ERROR_CODES.REDEMPTION_WINDOW_CLOSED,
        'Redemption window is closed',
      );
    }
    throw new IssueError(
      ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED,
      'Redemption window is closed',
    );
  }
}

/** Gate reserve/confirm: ACTIVE business + check-in window (archive OK). */
export async function assertOpenForGate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<void> {
  const event = await lockEventPolicyForShare(tx, tenantId, eventId);
  if (!event) {
    throw new GateError(GATE_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (event.business_status === 'CANCELLED') {
    throw new GateError(
      GATE_ERROR_CODES.EVENT_CANCELLED,
      'Event is cancelled',
    );
  }
  const now = await dbClock(tx);
  if (!isWindowOpen(now, event.check_in_opens_at, event.check_in_closes_at)) {
    throw new GateError(
      GATE_ERROR_CODES.CHECKIN_WINDOW_CLOSED,
      'Check-in window is closed',
    );
  }
}
