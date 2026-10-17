import { bffApiError, isUuid } from '../../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../../src/platform/contracts';
import { forwardTenantBearer } from '../../../../../../src/platform/forward';

type Props = { params: Promise<{ tenantId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  return forwardTenantBearer(PLATFORM_PATHS.members(tenantId), {
    method: 'GET',
  });
}
