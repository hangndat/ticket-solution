import {
  bffApiError,
  forwardWithBearer,
  isUuid,
} from '../../../../../src/bff/upstream';

type Props = { params: Promise<{ ticketId: string }> };

/**
 * Same-origin BFF: GET Nest /v1/me/tickets/{ticketId}?tenantId=
 * Owner-auth detail for email deeplink `/t/{slug}/tickets/{id}` (TD §10 / #400).
 * Caller must resolve slug→tenantId (UUID) via me/tenants — no tenantSlug query.
 */
export async function GET(request: Request, { params }: Props) {
  const { ticketId: rawId } = await params;
  const ticketId = rawId?.trim() ?? '';
  if (!isUuid(ticketId)) {
    return bffApiError('TICKET_ID_REQUIRED', 'ticketId must be a UUID.', 422);
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError(
      'TENANT_REQUIRED',
      'tenantId query parameter must be a UUID.',
      422,
    );
  }

  const path =
    `/v1/me/tickets/${encodeURIComponent(ticketId)}` +
    `?tenantId=${encodeURIComponent(tenantId)}`;
  return forwardWithBearer(path, { method: 'GET' });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
