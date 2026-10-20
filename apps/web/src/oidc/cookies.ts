import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'oidc_access_token';
export const REFRESH_COOKIE = 'oidc_refresh_token';
/** Stored for RP-initiated logout `id_token_hint` (silent end-session). */
export const ID_TOKEN_COOKIE = 'oidc_id_token';
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

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ID_TOKEN_COOKIE);
  jar.delete(PKCE_COOKIE);
  jar.delete(STATE_COOKIE);
}
