import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';

type Params = { params: Promise<{ clientKey: string }> };

/** Same-origin BFF: GET Nest /v1/operations/{clientOperationId} */
export async function GET(request: Request, { params }: Params) {
  const { clientKey } = await params;
  const key = clientKey?.trim() ?? '';
  if (!key) {
    return bffApiError('SCOPE_REQUIRED', 'clientOperationId is required.', 422);
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  const eventId = url.searchParams.get('eventId')?.trim() ?? '';
  const command = url.searchParams.get('command')?.trim() || 'redeem';

  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId query parameters must be UUIDs.',
      422,
    );
  }

  const qs = new URLSearchParams({
    tenantId,
    eventId,
    command,
  });
  const path = `/v1/operations/${encodeURIComponent(key)}?${qs.toString()}`;
  return forwardWithBearer(path, { method: 'GET' });
}
