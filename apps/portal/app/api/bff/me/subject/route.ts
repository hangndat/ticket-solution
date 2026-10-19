import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { readStaffSubject } from '../../../../../src/oidc/cookies';

/**
 * GET /api/bff/me/subject — portal-local identity for P2a saved-view prefs.
 * Returns OIDC `sub` so client localStorage can key by userId+tenantId (AC-B2).
 * Does not call Nest; does not expose tokens.
 */
export async function GET() {
  await ensureCsrfCookie();
  const userId = await readStaffSubject();
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json',
  });
  if (!userId) {
    return new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
      status: 401,
      headers,
    });
  }
  return new Response(JSON.stringify({ userId }), { status: 200, headers });
}
