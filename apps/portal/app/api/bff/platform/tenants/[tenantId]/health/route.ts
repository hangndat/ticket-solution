import { ensureCsrfCookie } from '../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardPlatformBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

/**
 * H-P2 — sanitized tenant health counters.
 * Platform cookie / audience / MFA ACR only — never staff Bearer.
 */
export async function GET(_request: Request, { params }: Props) {
  await ensureCsrfCookie();
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  const res = await forwardPlatformBearer(
    PORTAL_UPSTREAM.platformTenantHealth(tenantId),
    { method: 'GET' },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
