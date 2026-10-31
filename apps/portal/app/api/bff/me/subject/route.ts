import { ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { verifiedActorBinding } from '../../../../../src/oidc/actor-epoch';

/**
 * GET /api/bff/me/subject — portal-local identity for P2a saved-view prefs.
 * Returns OIDC `sub` so client localStorage can key by userId+tenantId (AC-B2).
 * Does not call Nest; does not expose tokens.
 */
export async function GET() {
  await ensureCsrfCookie();
  const binding = await verifiedActorBinding('staff');
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json',
  });
  if (!binding) {
    return new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
      status: 401,
      headers,
    });
  }
  headers.set('X-Portal-Actor-Id', binding.actorId);
  headers.set('X-Portal-Auth-Epoch', binding.authEpoch);
  headers.set('X-Portal-Surface', binding.surface);
  return new Response(JSON.stringify({ userId: binding.actorId }), { status: 200, headers });
}
