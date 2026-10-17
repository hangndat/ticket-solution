type EventScope = { tenantId: string; eventId: string };

function eventTicketsBase(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/tickets`;
}

/** Upstream paths from the approved CS contract (exact response types still pending). */
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

export type CsView =
  | { kind: 'list'; items: unknown[]; cursor: string | null; raw: unknown }
  | { kind: 'detail'; ticketId: string; raw: unknown }
  | { kind: 'resent'; ticketId: string; providerStatus: string | null; raw: unknown }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const CS_UNKNOWN =
  'Kết quả CS chưa biết. Không coi là đã tìm thấy hoặc đã gửi lại email.';

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function itemsFromBody(body: Record<string, unknown>): unknown[] | null {
  for (const key of ['tickets', 'items', 'results'] as const) {
    if (Array.isArray(body[key])) return body[key] as unknown[];
  }
  return null;
}

/** Loose interpreters — do not freeze field names until BE ships exact types. */
export function interpretCsList(
  status: number,
  json: unknown,
  networkError: boolean,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 && body) {
    const items = itemsFromBody(body);
    if (items) {
      const cursor =
        typeof body.cursor === 'string'
          ? body.cursor
          : typeof body.nextCursor === 'string'
            ? body.nextCursor
            : null;
      return { kind: 'list', items, cursor, raw: json };
    }
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: CS_UNKNOWN };
}

export function interpretCsDetail(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = record(json);
  if ((status === 200 || status === 201) && body) {
    return { kind: 'detail', ticketId, raw: json };
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: CS_UNKNOWN };
}

export function interpretCsResend(
  status: number,
  json: unknown,
  networkError: boolean,
  ticketId: string,
): CsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CS_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 || status === 201 || status === 202) {
    const providerStatus =
      typeof body?.providerStatus === 'string'
        ? body.providerStatus
        : typeof body?.status === 'string'
          ? body.status
          : null;
    // ACCEPTED means accepted by provider pipeline — never claim delivered.
    return {
      kind: 'resent',
      ticketId,
      providerStatus,
      raw: json,
    };
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: CS_UNKNOWN };
}

export function csViewLabel(view: CsView): string {
  if (view.kind === 'list') {
    return `CS: ${view.items.length} kết quả${view.cursor ? ' (còn trang sau)' : ''}. PII mặc định đã che.`;
  }
  if (view.kind === 'detail') {
    return `CS: đã tải chi tiết vé ${view.ticketId}.`;
  }
  if (view.kind === 'resent') {
    const status = view.providerStatus ?? 'unknown';
    return `CS: đã yêu cầu gửi lại email cho ${view.ticketId} (provider=${status}). ACCEPTED ≠ đã giao.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
