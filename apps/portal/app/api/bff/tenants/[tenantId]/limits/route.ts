import { isUuid } from '../../../../../../src/bff/ids';
import { withPrivateNoStore } from '../../../../../../src/bff/cache-control';
import { PORTAL_UPSTREAM } from '../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

/** G-10 tenant read — no query string (API rejects extra params). */
export async function GET(_request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  const res = await forwardStaffBearer(PORTAL_UPSTREAM.tenantLimits(tenantId), {
    method: 'GET',
  });
  return withPrivateNoStore(res);
}
