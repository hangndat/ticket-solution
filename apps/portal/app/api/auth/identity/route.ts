import { actorEpochPair, verifiedActorBinding } from '../../../../src/oidc/actor-epoch';
import { refreshStaffAccessToken } from '../../../../src/oidc/refresh';

export async function GET(request: Request) {
  const surface = new URL(request.url).searchParams.get('surface');
  if (surface !== 'staff' && surface !== 'platform') {
    return Response.json({ code: 'INVALID_SURFACE' }, {
      status: 400,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  let binding = await verifiedActorBinding(surface);
  if (!binding && surface === 'staff' && await actorEpochPair('staff')) {
    const refreshed = await refreshStaffAccessToken();
    if (refreshed.ok) binding = await verifiedActorBinding('staff', refreshed.accessToken);
  }
  if (!binding) {
    return Response.json({ code: 'UNAUTHENTICATED' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return Response.json(binding, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
