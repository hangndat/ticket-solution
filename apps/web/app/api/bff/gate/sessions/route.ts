import { assertSameOrigin } from '../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';

type Body = { tenantId?: string; eventId?: string };

/** POST /api/bff/gate/sessions → POST /v1/gate/events/{eventId}/sessions */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError('SCOPE_REQUIRED', 'tenantId and eventId must be UUIDs.', 422);
  }
  return forwardWithBearer(
    `/v1/gate/events/${encodeURIComponent(eventId)}/sessions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    },
  );
}
