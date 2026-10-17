/** Create-event path proposal — BE has not shipped OpenAPI yet. */
export function createEventUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/events`;
}

export type CreateEventView =
  | {
      kind: 'created';
      eventId: string;
      slug: string | null;
      name: string | null;
      raw: unknown;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const CREATE_EVENT_UNKNOWN =
  'Kết quả tạo event chưa biết. Không coi là đã tạo sự kiện.';

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

/**
 * Loose interpreter for POST create event.
 * Accepts eventId/id when present; does not freeze the full request schema.
 */
export function interpretCreateEvent(
  status: number,
  json: unknown,
  networkError: boolean,
): CreateEventView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 || status === 201) {
    const eventId =
      typeof body?.eventId === 'string'
        ? body.eventId
        : typeof body?.id === 'string'
          ? body.id
          : null;
    if (eventId && eventId.trim()) {
      return {
        kind: 'created',
        eventId: eventId.trim(),
        slug: typeof body?.slug === 'string' ? body.slug : null,
        name: typeof body?.name === 'string' ? body.name : null,
        raw: json,
      };
    }
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  // 404 often means BE route not shipped yet — still unknown/rejected via code if present.
  if (status === 404) {
    return {
      kind: 'rejected',
      code: 'EVENT_CREATE_UNAVAILABLE',
      message:
        'API tạo event chưa có trên upstream (404). Tenant đã provision vẫn cần BE POST /v1/tenants/{tenantId}/events.',
    };
  }
  return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
}

export function createEventLabel(view: CreateEventView): string {
  if (view.kind === 'created') {
    const slug = view.slug ? ` · ${view.slug}` : '';
    const name = view.name ? ` (${view.name})` : '';
    return `Đã tạo event ${view.eventId}${slug}${name}. Tiếp tục cấu hình/publish/import trên form.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
