import { bffApiError, isUuid } from '../../../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../../../src/platform/contracts';
import { forwardPlatformBearer } from '../../../../../../../src/platform/forward';

type Props = { params: Promise<{ tenantId: string }> };

/** GET sanitized health counts — never payloads/emails. */
export async function GET(_request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  return forwardPlatformBearer(PLATFORM_PATHS.platformTenantHealth(tenantId), {
    method: 'GET',
  });
}
