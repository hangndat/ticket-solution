/**
 * D-7 cutover — legacy admin/platform BFF and platform auth on apps/web.
 */

const LEGACY_GONE_PREFIXES = [
  '/api/bff/admin',
  '/api/bff/platform',
  '/api/auth/platform',
] as const;

export function isLegacyStaffApiPath(pathname: string): boolean {
  const path = pathname || '/';
  for (const prefix of LEGACY_GONE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function legacyStaffApiGoneResponse(): Response {
  return Response.json(
    { code: 'LEGACY_GONE', message: 'Staff API moved to portal.vemoki.com.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
