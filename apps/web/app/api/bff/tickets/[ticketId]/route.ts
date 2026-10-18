import { isTenantSlug } from '../../../../../src/branding';
import {
  bffApiError,
  forwardWithBearer,
  isUuid,
} from '../../../../../src/bff/upstream';

type Props = { params: Promise<{ ticketId: string }> };

/**
 * Same-origin BFF: GET Nest /v1/me/tickets/{ticketId}?tenantSlug=
 * Owner-auth detail for email deeplink `/t/{slug}/tickets/{id}` (TD §10).
 */
export async function GET(request: Request, { params }: Props) {
  const { ticketId: rawId } = await params;
  const ticketId = rawId?.trim() ?? '';
  if (!isUuid(ticketId)) {
    return bffApiError('TICKET_ID_REQUIRED', 'ticketId must be a UUID.', 422);
  }

  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenantSlug')?.trim().toLowerCase() ?? '';
  if (!tenantSlug || !isTenantSlug(tenantSlug)) {
    return bffApiError(
      'TENANT_SLUG_REQUIRED',
      'tenantSlug query parameter must be a lowercase slug.',
      422,
    );
  }

  const path =
    `/v1/me/tickets/${encodeURIComponent(ticketId)}` +
    `?tenantSlug=${encodeURIComponent(tenantSlug)}`;
  return forwardWithBearer(path, { method: 'GET' });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
