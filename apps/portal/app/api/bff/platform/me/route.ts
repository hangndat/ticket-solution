import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import {
  forwardPlatformBearer,
  PORTAL_API_PATHS,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/platform/me — Operator discovery; platform cookie only. */
export async function GET() {
  await ensureCsrfCookie();
  const res = await forwardPlatformBearer(PORTAL_API_PATHS.platformMe, {
    method: 'GET',
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
