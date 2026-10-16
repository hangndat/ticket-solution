import { forwardWithBearer } from '../../../../src/bff/upstream';

/**
 * Same-origin BFF: read OIDC access token (HttpOnly cookie), forward to Nest.
 * Never puts access tokens in localStorage.
 */
export async function GET() {
  return forwardWithBearer('/v1/me', { method: 'GET' });
}
