import { bffApiError } from './api-error';
import {
  canonicalizeOrigin,
  resolvePublicOrigin,
  webPublicOriginAllowlist,
} from '../oidc/public-origin';

/**
 * Same-origin CSRF guard for cookie-authenticated mutating BFF routes.
 * Treats 127.0.0.1 and localhost as the same host for local UAT.
 * When WEB_PUBLIC_ORIGIN is set (prod), Origin must match that allowlist —
 * never trust request.url bind address alone (nginx → 127.0.0.1/0.0.0.0).
 */
export function assertSameOrigin(request: Request): Response | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }
  const origin = request.headers.get('origin');
  if (!origin) {
    // Fail-closed: cookie-authenticated mutations require Origin.
    // Sec-Fetch-Site alone is not enough to allow missing Origin.
    return bffApiError(
      'CSRF_ORIGIN_REQUIRED',
      'Mutating BFF calls require a matching Origin.',
      403,
    );
  }
  const actual = canonicalizeOrigin(origin);
  if (!actual) {
    return bffApiError('INVALID_REQUEST_URL', 'Request URL is invalid.', 400);
  }

  const allowlist = webPublicOriginAllowlist();
  if (allowlist.length > 0) {
    if (allowlist.includes(actual)) return null;
    return bffApiError(
      'CSRF_ORIGIN_MISMATCH',
      'Origin does not match this host.',
      403,
    );
  }

  const expected = canonicalizeOrigin(resolvePublicOrigin(request));
  if (!expected) {
    return bffApiError('INVALID_REQUEST_URL', 'Request URL is invalid.', 400);
  }
  if (actual !== expected) {
    return bffApiError(
      'CSRF_ORIGIN_MISMATCH',
      'Origin does not match this host.',
      403,
    );
  }
  return null;
}
