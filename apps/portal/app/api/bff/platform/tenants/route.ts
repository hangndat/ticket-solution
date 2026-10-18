import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { pickSearchParams } from '../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../src/bff/paths';
import { forwardPlatformBearer } from '../../../../../src/bff/upstream';

/** H-P1 — platform tenants list; platform cookie / audience only. */
export async function GET(request: Request) {
  await ensureCsrfCookie();
  const qs = pickSearchParams(new URL(request.url), ['cursor', 'limit']);
  const res = await forwardPlatformBearer(
    `${PORTAL_UPSTREAM.platformTenants}${qs}`,
    { method: 'GET' },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
