import { isUuid } from '../../../../../../../src/bff/ids';
import { withPrivateNoStore } from '../../../../../../../src/bff/cache-control';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

/** P2-A — org portfolio analytics (staff report.read; assignment filtered upstream). */
export async function GET(request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const qs = new URLSearchParams();
  const cursor = url.searchParams.get('cursor')?.trim();
  const limit = url.searchParams.get('limit')?.trim();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', limit);
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await forwardStaffBearer(
    `${PORTAL_UPSTREAM.portfolio(tenantId)}${suffix}`,
    { method: 'GET' },
  );
  return withPrivateNoStore(res);
}
