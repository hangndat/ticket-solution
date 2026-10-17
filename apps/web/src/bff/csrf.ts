import { cookies } from 'next/headers';
import { authCookieSecure, sessionCookieOptions } from '../oidc/cookies';
import { bffApiError } from './upstream';
import { assertSameOrigin } from './origin';
import { CSRF_COOKIE, CSRF_HEADER } from './csrf-constants';

export { CSRF_COOKIE, CSRF_HEADER } from './csrf-constants';

/** Issue or rotate a double-submit CSRF cookie for browser sessions. */
export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value?.trim() ?? '';
  if (existing.length >= 32) return existing;
  const token =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');
  jar.set(CSRF_COOKIE, token, {
    ...sessionCookieOptions(60 * 60 * 8),
    httpOnly: false, // readable by same-origin JS for header echo
    secure: authCookieSecure(),
    sameSite: 'lax',
  });
  return token;
}

/**
 * Full mutating guard: Origin/Sec-Fetch + CSRF double-submit + JSON Content-Type.
 * Host allowlist via WEB_PUBLIC_ORIGIN (canonical), never trust X-Forwarded-Host alone.
 */
export function assertMutatingBrowser(request: Request): Response | null {
  const originErr = assertSameOrigin(request);
  if (originErr) return originErr;

  const allowlist = (process.env.WEB_PUBLIC_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length > 0) {
    const origin = request.headers.get('origin');
    if (origin) {
      let ok = false;
      try {
        const o = new URL(origin);
        const canon =
          o.hostname === '127.0.0.1' || o.hostname === '::1'
            ? `http://localhost${o.port ? `:${o.port}` : ''}`
            : origin;
        ok = allowlist.some((allowed) => {
          try {
            const a = new URL(allowed);
            const aCanon =
              a.hostname === '127.0.0.1' || a.hostname === '::1'
                ? `http://localhost${a.port ? `:${a.port}` : ''}`
                : allowed;
            return aCanon === canon || allowed === origin;
          } catch {
            return false;
          }
        });
      } catch {
        ok = false;
      }
      if (!ok) {
        return bffApiError(
          'CSRF_ORIGIN_NOT_ALLOWED',
          'Origin is not on WEB_PUBLIC_ORIGIN allowlist.',
          403,
        );
      }
    }
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return bffApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Mutating BFF requires Content-Type: application/json.',
      415,
    );
  }

  const headerToken = request.headers.get(CSRF_HEADER)?.trim() ?? '';
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`),
  );
  const cookieToken = match?.[1]?.trim() ?? '';
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return bffApiError(
      'CSRF_TOKEN_INVALID',
      'CSRF token missing or mismatched.',
      403,
    );
  }
  return null;
}

export async function assertMutatingBrowserAsync(
  request: Request,
): Promise<Response | null> {
  const sync = assertMutatingBrowser(request);
  if (sync) return sync;
  await ensureCsrfCookie();
  return null;
}
