import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import {
  forwardStaffBearer,
  PORTAL_API_PATHS,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/me/events — O02 MeEvents discovery. */
export async function GET() {
  await ensureCsrfCookie();
  const res = await forwardStaffBearer(PORTAL_API_PATHS.meEvents, {
    method: 'GET',
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
