import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  optionalString,
} from './contract-shape';

export function createEventUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/events`;
}

export function eventsListUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/events`;
}

export type CreateEventView =
  | {
      kind: 'created';
      eventId: string;
      slug: string;
      name: string;
      status: string;
      timezone: string;
      replayed: boolean | null;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type EventListView =
  | {
      kind: 'list';
      items: Array<{
        eventId: string;
        slug: string;
        name: string;
        status: string;
        timezone: string;
      }>;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const CREATE_EVENT_UNKNOWN =
  'Kết quả tạo event chưa biết. Không coi là đã tạo sự kiện.';

export const EVENT_LIST_UNKNOWN =
  'Kết quả danh sách event chưa biết. Không hiện danh sách theo shape sai.';

function parseEventSummary(body: Record<string, unknown> | null): {
  eventId: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  replayed: boolean | null;
} | null {
  if (!body) return null;
  if (
    !isNonEmptyString(body.eventId) ||
    !isNonEmptyString(body.slug) ||
    !isNonEmptyString(body.name) ||
    !isNonEmptyString(body.status) ||
    !isNonEmptyString(body.timezone)
  ) {
    return null;
  }
  return {
    eventId: body.eventId.trim(),
    slug: body.slug.trim(),
    name: body.name.trim(),
    status: body.status.trim(),
    timezone: body.timezone.trim(),
    replayed: typeof body.replayed === 'boolean' ? body.replayed : null,
  };
}

/**
 * Strict EventSummaryDto interpreter (BE PR54).
 * Rejects legacy aliases (id) and incomplete success bodies.
 */
export function interpretCreateEvent(
  status: number,
  json: unknown,
  networkError: boolean,
): CreateEventView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 || status === 201) {
    const summary = parseEventSummary(body);
    if (summary) {
      return { kind: 'created', ...summary };
    }
    return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
}

export function interpretEventList(
  status: number,
  json: unknown,
  networkError: boolean,
): EventListView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EVENT_LIST_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body && Array.isArray(body.items)) {
    const items: Array<{
      eventId: string;
      slug: string;
      name: string;
      status: string;
      timezone: string;
    }> = [];
    for (const row of body.items) {
      const summary = parseEventSummary(asRecord(row));
      if (!summary) {
        return { kind: 'unknown', message: EVENT_LIST_UNKNOWN };
      }
      items.push({
        eventId: summary.eventId,
        slug: summary.slug,
        name: summary.name,
        status: summary.status,
        timezone: summary.timezone,
      });
    }
    return { kind: 'list', items };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EVENT_LIST_UNKNOWN };
}

export function createEventLabel(view: CreateEventView): string {
  if (view.kind === 'created') {
    const replay = view.replayed ? ' (replayed)' : '';
    return `Đã tạo event ${view.eventId} · ${view.slug} (${view.name}) · ${view.status}${replay}.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}

export function eventListLabel(view: EventListView): string {
  if (view.kind === 'list') {
    return `Danh sách event: ${view.items.length} mục.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}

/** @deprecated kept for call sites that only need slug/name display */
export function optionalEventField(value: unknown): string | null {
  return optionalString(value);
}
