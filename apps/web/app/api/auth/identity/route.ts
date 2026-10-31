import { forwardWithBearer } from '../../../../src/bff/upstream';

/** Identity is validated by the API and bound to the incoming Web epoch. */
export async function GET() {
  const response = await forwardWithBearer('/v1/me', { method: 'GET' });
  if (!response.ok) {
    return new Response(null, {
      status: response.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  const actorId = response.headers.get('X-Actor-Id');
  const authEpoch = response.headers.get('X-Auth-Epoch');
  const surface = response.headers.get('X-Auth-Surface');
  if (!actorId || !authEpoch || !surface) {
    return new Response(null, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return Response.json(
    { actorId, authEpoch, surface },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
