import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { PLATFORM_PATHS } from '../../../../../src/platform/contracts';
import { forwardPlatformBearer } from '../../../../../src/platform/forward';

/** GET /api/bff/platform/me → GET /v1/platform/me */
export async function GET() {
  await ensureCsrfCookie();
  const res = await forwardPlatformBearer(PLATFORM_PATHS.platformMe, {
    method: 'GET',
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
