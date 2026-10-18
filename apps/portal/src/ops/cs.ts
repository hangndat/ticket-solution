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

/**
 * Honest VI copy for delivery/provider status.
 * ACCEPTED never claims end-user delivery. DELIVERED only when status is
 * literally DELIVERED (server evidence) — CS OpenAPI does not invent it.
 */
export function csProviderStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'PENDING (đang chờ gửi)';
    case 'FAILED':
      return 'FAILED (gửi lỗi — có thể thử lại theo quyền)';
    case 'DEAD':
      return 'DEAD (hết retry hữu ích — cần CS xử lý)';
    case 'ACCEPTED':
      return 'ACCEPTED (nhà cung cấp nhận — ≠ đã giao tới người nhận)';
    case 'DELIVERED':
      return 'DELIVERED (có bằng chứng giao từ server)';
    case 'UNKNOWN':
      return 'UNKNOWN (không rõ — không khẳng định đã gửi)';
    default:
      return `${status} (trạng thái chưa map — không khẳng định đã giao)`;
  }
}

/** Rejected-resend VI copy: cooldown, limit, permission, pending/error clarity. */
export function csResendRejectedLabel(code: string, message: string): string {
  if (code === 'RESEND_COOLDOWN') {
    return `RESEND_COOLDOWN: đang trong thời gian chờ gửi lại (~${CS_RESEND_COOLDOWN_SECONDS}s). Chưa tạo vé mới — thử lại sau.`;
  }
  if (code === 'RESEND_LIMIT') {
    return 'RESEND_LIMIT: đã hết hạn mức gửi lại trong cửa sổ hiện tại. Không tạo vé mới.';
  }
  if (code === 'PERMISSION_DENIED') {
    return 'PERMISSION_DENIED: thiếu quyền CS (cs.lookup / cs.resend) — không tra cứu hoặc gửi lại email.';
  }
  if (
    code === 'MEMBERSHIP_REQUIRED' ||
    code === 'TENANT_REQUIRED' ||
    code === 'EVENT_ACCESS_DENIED'
  ) {
    return `${code}: không có quyền trên tenant/event này — không gửi lại email.`;
  }
  return `${code}: ${message}`;
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
export function formatCsTimelineItem(item: CsTimelineItem): CsTimelineDisplay {
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
      action: `Gửi ${channel}`,
      result: status
        ? csProviderStatusLabel(status)
        : summary || 'không có kết quả từ server',
    };
  }

  if (kind === 'checkin.confirmed') {
    return { time, action: 'Check-in', result: 'Đã xác nhận vào cổng' };
  }
  if (kind === 'checkin.undone') {
    return { time, action: 'Check-in', result: 'Đã hoàn tác check-in' };
  }

  // Audit / other: keep server kind as action, summary as result.
  return {
    time,
    action: kind || 'Thao tác',
    result: summary || '—',
  };
}

export function csNotificationStatusText(
  notification: CsNotification | null,
): string {
  if (!notification) return 'Chưa có bản ghi gửi email trên server';
  return csProviderStatusLabel(notification.providerStatus);
}

export function csViewLabel(view: CsView): string {
  if (view.kind === 'list') {
    return `CS: ${view.items.length} kết quả${view.cursor ? ' (còn trang sau)' : ''}. PII mặc định đã che.`;
  }
  if (view.kind === 'detail') {
    const delivery = csNotificationStatusText(view.ticket.notification);
    return `CS: chi tiết vé ${view.ticket.ticketId} · ${view.ticket.timeline.length} timeline · email=${view.ticket.ownerEmailMasked ?? 'null'} · ${delivery}.`;
  }
  if (view.kind === 'resent') {
    return `CS: đã yêu cầu gửi lại email cho ${view.ticketId} (provider=PENDING, replayed=${view.replayed}). PENDING ≠ đã giao.`;
  }
  if (view.kind === 'rejected') {
    return csResendRejectedLabel(view.code, view.message);
  }
  return view.message;
}
