import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'oidc_access_token';
export const REFRESH_COOKIE = 'oidc_refresh_token';
export const PKCE_COOKIE = 'oidc_pkce_verifier';
export const STATE_COOKIE = 'oidc_oauth_state';

export function authCookieSecure(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.AUTH_COOKIE_SECURE === 'true';
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function readAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACCESS_COOKIE)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

/** Origin for redirects behind nginx. Next's bind address is 0.0.0.0, which must not leak into Location. */
export function publicOrigin(request: { headers: Headers; url: string }): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && proto && !forwardedHost.startsWith('0.0.0.0')) {
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(PKCE_COOKIE);
  jar.delete(STATE_COOKIE);
}
