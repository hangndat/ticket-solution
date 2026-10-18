import { cookies } from 'next/headers';
import { sessionCookieOptions } from '@ticket/web-session';
import { assertSameOrigin } from './origin';
import { bffApiError } from './api-error';

export const CSRF_COOKIE = 'portal_csrf';
export const CSRF_HEADER = 'x-portal-csrf';

export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value?.trim() ?? '';
  if (existing.length >= 32) return existing;
  const token =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');
  const base = sessionCookieOptions(60 * 60 * 8);
  jar.set(CSRF_COOKIE, token, {
    ...base,
    httpOnly: false,
  });
  return token;
}

/** Origin fail-closed + double-submit CSRF for mutating portal BFF. */
export async function assertMutatingBrowser(
  request: Request,
): Promise<Response | null> {
  const originErr = assertSameOrigin(request);
  if (originErr) return originErr;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return bffApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Mutating BFF requires Content-Type: application/json.',
      415,
    );
  }

  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value?.trim() ?? '';
  const headerToken = request.headers.get(CSRF_HEADER)?.trim() ?? '';
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return bffApiError(
      'CSRF_TOKEN_MISMATCH',
      'CSRF token missing or mismatched.',
      403,
    );
  }
  return null;
}
