import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';

type Params = { params: Promise<{ requestId: string }> };

/** Owner current status: GET /v1/me/redemptions/{requestId} */
export async function GET(_request: Request, { params }: Params) {
  const { requestId } = await params;
  const id = requestId?.trim() ?? '';
  if (!id || !isUuid(id)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'requestId must be a UUID.',
      422,
    );
  }
  return forwardWithBearer(
    `/v1/me/redemptions/${encodeURIComponent(id)}`,
    { method: 'GET' },
  );
}
