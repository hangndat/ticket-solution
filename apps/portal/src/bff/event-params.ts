import { isUuid } from './ids';
import { bffApiError } from './api-error';

export type EventRouteParams = { tenantId: string; eventId: string };

/** Parse + validate tenantId/eventId from Next App Router params. */
export async function requireEventParams(
  params: Promise<EventRouteParams>,
): Promise<EventRouteParams | Response> {
  const { tenantId: rawT, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return { tenantId, eventId };
}

export function isEventParams(
  value: EventRouteParams | Response,
): value is EventRouteParams {
  return !(value instanceof Response);
}

/** Forward allowlisted query keys from the browser request to Nest. */
export function pickSearchParams(
  url: URL,
  keys: readonly string[],
): string {
  const out = new URLSearchParams();
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value != null && value !== '') out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}
