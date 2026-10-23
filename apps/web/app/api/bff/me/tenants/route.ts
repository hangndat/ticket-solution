import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { PLATFORM_PATHS } from '../../../../../src/bff/platform-contracts';
import { forwardTenantBearer } from '../../../../../src/bff/platform-forward';

/** GET /api/bff/me/tenants — tenant selector discovery (no UUID-only UX). */
export async function GET() {
  await ensureCsrfCookie();
  const res = await forwardTenantBearer(PLATFORM_PATHS.meTenants, {
    method: 'GET',
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
