import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  ticketId?: string;
  staffSessionId?: string;
};

/** POST /api/bff/gate/reservations → hold a ticket for this staff session. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  const ticketId = body.ticketId?.trim() ?? '';
  const staffSessionId = body.staffSessionId?.trim() ?? '';
  if (![tenantId, eventId, ticketId, staffSessionId].every(isUuid)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId, eventId, ticketId, and staffSessionId must be UUIDs.',
      422,
    );
  }
  return forwardWithBearer(
    `/v1/gate/events/${encodeURIComponent(eventId)}/reservations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, ticketId, staffSessionId }),
    },
  );
}
