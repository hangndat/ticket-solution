import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  isProviderStatus,
  optionalString,
} from './contract-shape';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

type EventScope = { tenantId: string; eventId: string };

function eventTicketsBase(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/tickets`;
}

export function ticketsListPath(
  scope: EventScope,
  query: { q?: string; limit?: number; cursor?: string },
): string {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
    params.set('limit', String(Math.trunc(query.limit)));
  }
  if (query.cursor?.trim()) params.set('cursor', query.cursor.trim());
  const qs = params.toString();
  return `${eventTicketsBase(scope)}${qs ? `?${qs}` : ''}`;
}

export function ticketDetailPath(scope: EventScope, ticketId: string): string {
  return `${eventTicketsBase(scope)}/${encodeURIComponent(ticketId)}`;
}

export function ticketResendPath(scope: EventScope, ticketId: string): string {
  return `${eventTicketsBase(scope)}/${encodeURIComponent(ticketId)}/resend`;
}

/** CS notification providerStatus from OpenAPI — never invent DELIVERED. */
export type CsProviderStatus = 'PENDING' | 'ACCEPTED' | 'FAILED' | 'DEAD';

export type CsNotification = {
  channel: string;
  state: string;
  providerStatus: CsProviderStatus;
  providerRef: string | null;
  attempts: number;
  lastError: null;
};

/** Contract default for ticket resend cooldown (seconds). */
export const CS_RESEND_COOLDOWN_SECONDS = 60;

export type CsTicketSummary = {
  ticketId: string;
  state: string;
  ticketTypeId: string;
  sourceId: string;
  createdAt: string;
  ownerEmailMasked: string | null;
  lastCheckInAt: string | null;
  notification: CsNotification | null;
};

export type CsTimelineItem = {
  at: string;
  kind: string;
  summary: string;
};

export type CsTicketDetail = CsTicketSummary & {
  timeline: CsTimelineItem[];
};

export type CsView =
  | {
      kind: 'list';
      items: CsTicketSummary[];
      cursor: string | null;
    }
  | { kind: 'detail'; ticket: CsTicketDetail }
  | {
      kind: 'resent';
      ticketId: string;
      operationId: string;
      notificationId: string;
      providerStatus: 'PENDING';
      replayed: boolean;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const CS_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.h_gafwuk');

function parseNotification(value: unknown): CsNotification | null | false {
  if (value === null) return null;
  const body = asRecord(value);
  if (!body) return false;
  if (
    !isNonEmptyString(body.channel) ||
    !isNonEmptyString(body.state) ||
    !isProviderStatus(body.providerStatus) ||
    typeof body.attempts !== 'number' ||
    !Number.isFinite(body.attempts) ||
    body.lastError !== null
  ) {
    return false;
  }
  return {
    channel: body.channel,
    state: body.state,
    providerStatus: body.providerStatus,
    providerRef: optionalString(body.providerRef),
    attempts: body.attempts,
    lastError: null,
  };
}

function parseTicketSummary(value: unknown): CsTicketSummary | null {
  const body = asRecord(value);
  if (!body) return null;
  if (
    !isNonEmptyString(body.ticketId) ||
    !isNonEmptyString(body.state) ||
    !isNonEmptyString(body.ticketTypeId) ||
    !isNonEmptyString(body.sourceId) ||
    !isNonEmptyString(body.createdAt)
  ) {
    return null;
  }
  // ownerEmailMasked / lastCheckInAt are nullable strings — reject raw PII keys.
  if ('ownerEmail' in body || 'email' in body || 'rawEmail' in body) {
    return null;
  }
  if (
    body.ownerEmailMasked !== null &&
    typeof body.ownerEmailMasked !== 'string'
  ) {
    return null;
  }
  if (body.lastCheckInAt !== null && typeof body.lastCheckInAt !== 'string') {
    return null;
  }
  const notification = parseNotification(body.notification);
  if (notification === false) return null;
  return {
    ticketId: body.ticketId.trim(),
    state: body.state,
    ticketTypeId: body.ticketTypeId.trim(),
    sourceId: body.sourceId.trim(),
    createdAt: body.createdAt,
    ownerEmailMasked: body.ownerEmailMasked,
    lastCheckInAt: body.lastCheckInAt,
    notification,
  };
}

function parseTimelineItem(value: unknown): CsTimelineItem | null {
  const body = asRecord(value);
  if (!body) return null;
  if (
    !isNonEmptyString(body.at) ||
    !isNonEmptyString(body.kind) ||
    !isNonEmptyString(body.summary)
  ) {
    return null;
  }
  return { at: body.at, kind: body.kind, summary: body.summary };
}

function parseTicketDetail(value: unknown): CsTicketDetail | null {
  const summary = parseTicketSummary(value);
  if (!summary) return null;
  const body = asRecord(value);
  if (!body || !Array.isArray(body.timeline)) return null;
  const timeline: CsTimelineItem[] = [];
  for (const row of body.timeline) {
    const item = parseTimelineItem(row);
    if (!item) return null;
    timeline.push(item);
  }
  return { ...summary, timeline };
}

/** Strict CsTicketListDto — only `items` + `nextCursor` (no tickets/results aliases). */
export function interpretCsList(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  const body = asRecord(json);
  if (status === 200 && body && Array.isArray(body.items)) {
    if (!('nextCursor' in body)) {
      return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
    }
    if (body.nextCursor !== null && typeof body.nextCursor !== 'string') {
      return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
    }
    const items: CsTicketSummary[] = [];
    for (const row of body.items) {
      const item = parseTicketSummary(row);
      if (!item) return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
      items.push(item);
    }
    return { kind: 'list', items, cursor: body.nextCursor };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
}

export function interpretCsDetail(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): CsView {
  void ticketId;
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  const body = asRecord(json);
  if (status === 200) {
    const ticket = parseTicketDetail(json);
    if (ticket) return { kind: 'detail', ticket };
    return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
}

/** Strict CsResendDto — providerStatus must be PENDING; ACCEPTED alone is invalid. */
export function interpretCsResend(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  const body = asRecord(json);
  if (status === 429) {
    const err = apiErrorFrom(body);
    return err && (err.code === 'RESEND_COOLDOWN' || err.code === 'RESEND_LIMIT')
      ? { kind: 'rejected', ...err }
      : { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  if (status === 200 || status === 201) {
    if (
      body &&
      isNonEmptyString(body.operationId) &&
      isNonEmptyString(body.notificationId) &&
      body.providerStatus === 'PENDING' &&
      typeof body.replayed === 'boolean'
    ) {
      return {
        kind: 'resent',
        ticketId,
        operationId: body.operationId.trim(),
        notificationId: body.notificationId.trim(),
        providerStatus: 'PENDING',
        replayed: body.replayed,
      };
    }
    return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_gafwuk') };
}

/**
 * Honest VI copy for delivery/provider status.
 * ACCEPTED never claims end-user delivery. DELIVERED only when status is
 * literally DELIVERED (server evidence) — CS OpenAPI does not invent it.
 */
export function csProviderStatusLabel(status: string, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  switch (status) {
    case 'PENDING':
      return t(locale, 'ops.h_1rulq3');
    case 'FAILED':
      return t(locale, 'ops.h_705wl6');
    case 'DEAD':
      return t(locale, 'ops.h_tn7vf3');
    case 'ACCEPTED':
      return t(locale, 'notify.acceptedProviderHint');
    case 'DELIVERED':
      return t(locale, 'ops.h_1kyhcv');
    case 'UNKNOWN':
      return t(locale, 'ops.h_r3tltl');
    default:
      return t(locale, 'common.mappedStatus', { status });
  }
}

/** Rejected-resend VI copy: cooldown, limit, permission, pending/error clarity. */
export function csResendRejectedLabel(code: string, message: string, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (code === 'RESEND_COOLDOWN') {
    return t(locale, 'ops.notifications.resendCooldown', { seconds: CS_RESEND_COOLDOWN_SECONDS });
  }
  if (code === 'RESEND_LIMIT') {
    return t(locale, 'ops.h_11ovicf');
  }
  if (code === 'PERMISSION_DENIED') {
    return t(locale, 'ops.h_r6ag2k');
  }
  if (
    code === 'MEMBERSHIP_REQUIRED' ||
    code === 'TENANT_REQUIRED' ||
    code === 'EVENT_ACCESS_DENIED'
  ) {
    return t(locale, 'common.apiForbiddenResend', { code });
  }
  return t(locale, 'ops.export.apiRejected', { code, message });
}

export type CsTimelineDisplay = {
  time: string;
  action: string;
  result: string;
};

/**
 * Map timeline row → thời gian / hành động / kết quả (VI when status known).
 * Does not invent DELIVERED from ACCEPTED.
 */
export function formatCsTimelineItem(item: CsTimelineItem, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): CsTimelineDisplay {
  const time = item.at;
  const kind = item.kind.trim();
  const summary = item.summary.trim();

  if (kind.startsWith('notification.')) {
    const channel = kind.slice('notification.'.length) || 'email';
    const statusMatch = /\b(PENDING|ACCEPTED|FAILED|DEAD|DELIVERED|UNKNOWN)\b/.exec(
      summary,
    );
    const status = statusMatch?.[1] ?? null;
    return {
      time,
      action: t(locale, 'ops.notifications.sendChannel', { channel }),
      result: status
        ? csProviderStatusLabel(status, locale)
        : summary || t(locale, 'ops.h_1oi6f3o'),
    };
  }

  if (kind === 'checkin.confirmed') {
    return { time, action: 'Check-in', result: t(locale, 'ops.h_1oi8zqp') };
  }
  if (kind === 'checkin.undone') {
    return { time, action: 'Check-in', result: t(locale, 'ops.h_c242jl') };
  }

  // Audit / other: keep server kind as action, summary as result.
  return {
    time,
    action: kind || t(locale, 'ops.h_1pbxt75'),
    result: summary || '—',
  };
}

export function csNotificationStatusText(
  notification: CsNotification | null,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  if (!notification) return t(locale, 'ops.h_m88eni');
  return csProviderStatusLabel(notification.providerStatus, locale);
}

export function csViewLabel(view: CsView, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (view.kind === 'list') {
    return t(locale, 'ops.cs.listSummary', { count: view.items.length, pageSuffix: view.cursor ? t(locale, 'common.pagination.pageSuffixAfter') : '' });
  }
  if (view.kind === 'detail') {
    const delivery = csNotificationStatusText(view.ticket.notification, locale);
    return t(locale, 'ops.cs.ticketDetail', { ticketId: view.ticket.ticketId, timelineCount: view.ticket.timeline.length, ownerEmailMasked: view.ticket.ownerEmailMasked ?? 'null', delivery });
  }
  if (view.kind === 'resent') {
    return t(locale, 'ops.cs.resendLabel', { ticketId: view.ticketId, replayed: view.replayed });
  }
  if (view.kind === 'rejected') {
    return csResendRejectedLabel(view.code, view.message, locale);
  }
  return view.message;
}
