import type { AdminScope } from './scope';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

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

/** Mirrors packages/backend EventReport O12 quotaCapacityState. */
export const QUOTA_CAPACITY_STATES = [
  'FINITE',
  'UNLIMITED',
  'MISSING_BUCKET',
] as const;

export type QuotaCapacityState = (typeof QUOTA_CAPACITY_STATES)[number];

export type ShownEventReport = {
  kind: 'shown';
  ticketsByState: TicketStateCounts;
  quota: { capacity: number | null; allocated: number };
  /** Remaining when FINITE; null for UNLIMITED / MISSING_BUCKET (never a fake 0). */
  quotaRemaining: number | null;
  quotaCapacityState: QuotaCapacityState;
  pendingApprovalCount: number;
  checkInSuccessCount: number;
  rejectByReason: Record<string, number>;
  emailNeedsCsCount: number;
  /** Server clock watermark (ISO-8601). */
  asOf: string;
};

export type EventReportView =
  | ShownEventReport
  | { kind: 'unknown'; message: string }
  | { kind: 'rejected'; code: string; message: string };

export const REPORT_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.report.unknown');

export function reportShowsNumbers(
  view: EventReportView,
): view is ShownEventReport {
  return view.kind === 'shown';
}

/** Portal section anchors for O12 P3 deep-links (no approve/resend on KPI). */
export const REPORT_PENDING_APPROVAL_SECTION_ID = 'pending';
export const REPORT_EMAIL_CS_SECTION_ID = 'cs';

export function reportPendingApprovalHref(
  tenantId: string,
  eventId: string,
): string {
  return `/t/${tenantId}/e/${eventId}/guests#${REPORT_PENDING_APPROVAL_SECTION_ID}`;
}

export function reportEmailCsHref(tenantId: string, eventId: string): string {
  return `/t/${tenantId}/e/${eventId}/support#${REPORT_EMAIL_CS_SECTION_ID}`;
}

export const REPORT_PENDING_APPROVAL_CTA_LABEL =
  t(DEFAULT_PORTAL_LOCALE, 'gate.h_1n09r0f');
export const REPORT_EMAIL_CS_CTA_LABEL =
  t(DEFAULT_PORTAL_LOCALE, 'gate.h_4twiex');

/** CTA only when shown + count > 0; never for unknown/rejected. */
export function reportShowsPendingApprovalCta(
  view: EventReportView,
): view is ShownEventReport {
  return reportShowsNumbers(view) && view.pendingApprovalCount > 0;
}

/** CTA only when shown + count > 0; never for unknown/rejected. */
export function reportShowsEmailCsCta(
  view: EventReportView,
): view is ShownEventReport {
  return reportShowsNumbers(view) && view.emailNeedsCsCount > 0;
}

export function formatQuotaCapacityState(state: QuotaCapacityState, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  switch (state) {
    case 'FINITE':
      return t(locale, 'ops.h_106x23o');
    case 'UNLIMITED':
      return t(locale, 'quota.h_1tnoz3k');
    case 'MISSING_BUCKET':
      return t(locale, 'ops.h_1f4t581');
  }
}

/** Display remaining: never invent 0 for UNLIMITED / MISSING_BUCKET. */
export function formatQuotaRemaining(
  remaining: number | null,
  state: QuotaCapacityState,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  if (state === 'FINITE' && remaining !== null) return String(remaining);
  return t(locale, 'ops.h_1lsqc1u');
}

export function formatReportAsOf(
  asOf: string,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  const ms = Date.parse(asOf);
  if (Number.isNaN(ms)) return asOf;
  const intlLocale = locale === 'en' ? 'en-US' : 'vi-VN';
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(ms));
  } catch {
    return asOf;
  }
}

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseQuotaCapacityState(value: unknown): QuotaCapacityState | null {
  if (typeof value !== 'string') return null;
  return (QUOTA_CAPACITY_STATES as readonly string[]).includes(value)
    ? (value as QuotaCapacityState)
    : null;
}

function parseRejectByReason(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string' || key.length === 0) return null;
    const n = finiteNumber(raw);
    if (n === null) return null;
    out[key] = n;
  }
  return out;
}

function parseAsOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  if (Number.isNaN(Date.parse(value))) return null;
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

  const quotaCapacityState = parseQuotaCapacityState(body.quotaCapacityState);
  if (!quotaCapacityState) return null;

  const remainingRaw = body.quotaRemaining;
  let quotaRemaining: number | null;
  if (quotaCapacityState === 'FINITE') {
    const n = finiteNumber(remainingRaw);
    if (n === null) return null;
    quotaRemaining = n;
  } else {
    // UNLIMITED / MISSING_BUCKET — remaining must be null (never a fake 0).
    if (remainingRaw !== null) return null;
    quotaRemaining = null;
  }

  const checkInSuccessCount = finiteNumber(body.checkInSuccessCount);
  const emailNeedsCsCount = finiteNumber(body.emailNeedsCsCount);
  const rejectByReason = parseRejectByReason(body.rejectByReason);
  const asOf = parseAsOf(body.asOf);
  if (
    checkInSuccessCount === null ||
    emailNeedsCsCount === null ||
    rejectByReason === null ||
    asOf === null
  ) {
    return null;
  }

  return {
    kind: 'shown',
    ticketsByState,
    quota: { capacity, allocated },
    quotaRemaining,
    quotaCapacityState,
    pendingApprovalCount,
    checkInSuccessCount,
    rejectByReason,
    emailNeedsCsCount,
    asOf,
  };
}

/**
 * Counts are current only for HTTP 200 with a complete O12 report.
 * Status >= 500, status 0, and network errors are unknown and carry no counts.
 */
export function interpretEventReport(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): EventReportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.report.unknown') };
  }

  const body = record(json);
  if (status === 200) {
    return parseShown(body) ?? { kind: 'unknown', message: t(locale, 'ops.report.unknown') };
  }

  if (body && typeof body.code === 'string' && body.code.length > 0) {
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message
        : body.code;
    return { kind: 'rejected', code: body.code, message };
  }

  return { kind: 'unknown', message: t(locale, 'ops.report.unknown') };
}
