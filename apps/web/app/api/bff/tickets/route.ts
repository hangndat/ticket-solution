import { bffApiError, forwardWithBearer, isUuid } from '../../../../src/bff/upstream';

/** Same-origin BFF: GET Nest /v1/me/tickets?tenantId= */
export async function GET(request: Request) {
  const tenantId =
    new URL(request.url).searchParams.get('tenantId')?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError(
      'TENANT_REQUIRED',
      'tenantId query parameter must be a UUID.',
      422,
    );
  }
  const path = `/v1/me/tickets?tenantId=${encodeURIComponent(tenantId)}`;
  return forwardWithBearer(path, { method: 'GET' });
}
