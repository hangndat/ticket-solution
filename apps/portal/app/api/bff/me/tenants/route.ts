import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import {
  forwardStaffBearer,
  PORTAL_API_PATHS,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/me/tenants — org selector discovery (server authority). */
export async function GET() {
  await ensureCsrfCookie();
  const res = await forwardStaffBearer(PORTAL_API_PATHS.meTenants, {
    method: 'GET',
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
