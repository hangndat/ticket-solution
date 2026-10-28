import { cookies } from 'next/headers';
import { SESSION_COOKIES } from '@ticket/web-session';
import { decodeJwt } from 'jose';
import { WEB_AUTH_COOKIES } from './local-cookies';
import { POST_LOGIN_COOKIE } from './post-login';

export const ACCESS_COOKIE = SESSION_COOKIES.access;
export const REFRESH_COOKIE = SESSION_COOKIES.refresh;
/** Stored for RP-initiated logout `id_token_hint` (silent end-session). */
export const ID_TOKEN_COOKIE = SESSION_COOKIES.idToken;
export const PKCE_COOKIE = SESSION_COOKIES.pkce;
export const STATE_COOKIE = SESSION_COOKIES.state;
export const NONCE_COOKIE = WEB_AUTH_COOKIES.nonce;

export { sessionCookieOptions } from '@ticket/web-session';

/** The callback owns this anchor; a late refresh response cannot recreate it. */
export function accessTokenMatchesSubject(token: string, subject: string | null): boolean {
  if (!subject) return false;
  try {
    return decodeJwt(token).sub === subject;
  } catch {
    return false;
  }
}

export async function readAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACCESS_COOKIE)?.value?.trim() ?? '';
  const subject = jar.get(WEB_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value && accessTokenMatchesSubject(value, subject) ? value : null;
}

export async function readRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(REFRESH_COOKIE)?.value?.trim() ?? '';
  const subject = jar.get(WEB_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value && subject ? value : null;
}

export async function readSubject(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(WEB_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

/** Never delete pending OIDC cookies from a BFF/refresh response. */
export async function clearEstablishedSessionCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ID_TOKEN_COOKIE, WEB_AUTH_COOKIES.subject]) {
    // A guest BFF response must not send late deletion headers into a new login.
    if (jar.has(name)) jar.delete(name);
  }
}

export async function clearPendingLoginCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of [PKCE_COOKIE, STATE_COOKIE, NONCE_COOKIE, POST_LOGIN_COOKIE]) {
    jar.delete(name);
  }
}

/** Explicit logout owns both established and pending login state. */
export async function clearSessionCookies(): Promise<void> {
  await clearEstablishedSessionCookies();
  await clearPendingLoginCookies();
}
