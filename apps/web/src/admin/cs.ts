import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  isProviderStatus,
  optionalString,
} from './contract-shape';

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

export type CsNotification = {
  channel: string;
  state: string;
  providerStatus: 'PENDING' | 'ACCEPTED' | 'FAILED' | 'DEAD';
  providerRef: string | null;
  attempts: number;
  lastError: null;
};

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
  'Kết quả CS chưa biết. Không coi là đã tìm thấy hoặc đã gửi lại email.';

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
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body && Array.isArray(body.items)) {
    if (!('nextCursor' in body)) {
      return { kind: 'unknown', message: CS_UNKNOWN };
    }
    if (body.nextCursor !== null && typeof body.nextCursor !== 'string') {
      return { kind: 'unknown', message: CS_UNKNOWN };
    }
    const items: CsTicketSummary[] = [];
    for (const row of body.items) {
      const item = parseTicketSummary(row);
      if (!item) return { kind: 'unknown', message: CS_UNKNOWN };
      items.push(item);
    }
    return { kind: 'list', items, cursor: body.nextCursor };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: CS_UNKNOWN };
}

export function interpretCsDetail(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
): CsView {
  void ticketId;
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200) {
    const ticket = parseTicketDetail(json);
    if (ticket) return { kind: 'detail', ticket };
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: CS_UNKNOWN };
}

/** Strict CsResendDto — providerStatus must be PENDING; ACCEPTED alone is invalid. */
export function interpretCsResend(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = asRecord(json);
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
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: CS_UNKNOWN };
}

export function csViewLabel(view: CsView): string {
  if (view.kind === 'list') {
    return `CS: ${view.items.length} kết quả${view.cursor ? ' (còn trang sau)' : ''}. PII mặc định đã che.`;
  }
  if (view.kind === 'detail') {
    return `CS: chi tiết vé ${view.ticket.ticketId} · ${view.ticket.timeline.length} timeline · email=${view.ticket.ownerEmailMasked ?? 'null'}.`;
  }
  if (view.kind === 'resent') {
    return `CS: đã yêu cầu gửi lại email cho ${view.ticketId} (provider=PENDING, replayed=${view.replayed}). PENDING ≠ đã giao.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
