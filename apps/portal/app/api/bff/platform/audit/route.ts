import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { pickSearchParams } from '../../../../../src/bff/event-params';
import { withPrivateNoStore } from '../../../../../src/bff/cache-control';
import { PORTAL_UPSTREAM } from '../../../../../src/bff/paths';
import { forwardPlatformBearer } from '../../../../../src/bff/upstream';

/** H-P-AUDIT — platform audit; never forward staff Bearer. */
export async function GET(request: Request) {
  await ensureCsrfCookie();
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'from',
    'to',
    'action',
    'tenantId',
  ]);
  const res = await forwardPlatformBearer(
    `${PORTAL_UPSTREAM.platformAudit}${qs}`,
    { method: 'GET' },
  );
  return withPrivateNoStore(res);
}
