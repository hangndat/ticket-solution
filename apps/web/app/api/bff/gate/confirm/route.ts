import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  reservationId?: string;
  staffSessionId?: string;
  token?: string;
};

/** POST /api/bff/gate/confirm → confirm a live hold. Unknown upstream is 502 retryable. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  const reservationId = body.reservationId?.trim() ?? '';
  const staffSessionId = body.staffSessionId?.trim() ?? '';
  const token = body.token?.trim() ?? '';
  if (![tenantId, eventId, reservationId, staffSessionId].every(isUuid) || !token) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId, eventId, reservationId, staffSessionId, and token are required.',
      422,
    );
  }
  return forwardWithBearer(
    `/v1/gate/events/${encodeURIComponent(eventId)}/reservations/${encodeURIComponent(reservationId)}/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, staffSessionId, token }),
    },
  );
}
