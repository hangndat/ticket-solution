import { bffApiError } from './api-error';

function canonicalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host =
      url.hostname === '127.0.0.1' || url.hostname === '::1'
        ? 'localhost'
        : url.hostname;
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return null;
  }
}

/**
 * Same-origin CSRF guard for cookie-authenticated mutating BFF routes.
 * Treats 127.0.0.1 and localhost as the same host for local UAT.
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
  const expected = canonicalizeOrigin(request.url);
  const actual = canonicalizeOrigin(origin);
  if (!expected || !actual) {
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
