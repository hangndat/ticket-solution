import type { AdminScope } from './scope';

/** GET path from apps/api/openapi.json — ReportController_report. */
export const EVENT_REPORT_OPENAPI_PATH =
  '/v1/tenants/{tenantId}/events/{eventId}/report';

export function reportUpstreamPath(scope: AdminScope): string {
  return EVENT_REPORT_OPENAPI_PATH.replaceAll(
    '{tenantId}',
    encodeURIComponent(scope.tenantId),
  ).replaceAll('{eventId}', encodeURIComponent(scope.eventId));
}

export const TICKET_STATES = [
  'ACTIVE',
  'REVOKED',
  'CANCELLED',
  'USED',
] as const;

export type TicketState = (typeof TICKET_STATES)[number];

export type TicketStateCounts = Record<TicketState, number>;

export type ShownEventReport = {
  kind: 'shown';
  ticketsByState: TicketStateCounts;
  quota: { capacity: number | null; allocated: number };
  pendingApprovalCount: number;
};

export type EventReportView =
  | ShownEventReport
  | { kind: 'unknown'; message: string }
  | { kind: 'rejected'; code: string; message: string };

export const REPORT_UNKNOWN =
  'Báo cáo chưa biết. Không hiện số vé, quota, hoặc số chờ duyệt như thể chúng đang đúng.';

export function reportShowsNumbers(
  view: EventReportView,
): view is ShownEventReport {
  return view.kind === 'shown';
}

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseShown(
  body: Record<string, unknown> | null,
): ShownEventReport | null {
  if (!body) return null;
  const states = record(body.ticketsByState);
  const quota = record(body.quota);
  if (!states || !quota) return null;

  const ticketsByState = {} as TicketStateCounts;
  for (const state of TICKET_STATES) {
    const count = finiteNumber(states[state]);
    if (count === null) return null;
    ticketsByState[state] = count;
  }

  const capacity =
    quota.capacity === null ? null : finiteNumber(quota.capacity);
  if (quota.capacity !== null && capacity === null) return null;
  const allocated = finiteNumber(quota.allocated);
  const pendingApprovalCount = finiteNumber(body.pendingApprovalCount);
  if (allocated === null || pendingApprovalCount === null) return null;

  return {
    kind: 'shown',
    ticketsByState,
    quota: { capacity, allocated },
    pendingApprovalCount,
  };
}

/**
 * Counts are current only for HTTP 200 with a complete report.
 * Status >= 500, status 0, and network errors are unknown and carry no counts.
 */
export function interpretEventReport(
  status: number,
  json: unknown,
  networkError: boolean,
): EventReportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: REPORT_UNKNOWN };
  }

  const body = record(json);
  if (status === 200) {
    return parseShown(body) ?? { kind: 'unknown', message: REPORT_UNKNOWN };
  }

  if (body && typeof body.code === 'string' && body.code.length > 0) {
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message
        : body.code;
    return { kind: 'rejected', code: body.code, message };
  }

  return { kind: 'unknown', message: REPORT_UNKNOWN };
}
