import { cookies } from 'next/headers';
import { SESSION_COOKIES } from '@ticket/web-session';
import { WEB_AUTH_COOKIES } from './local-cookies';

export const ACCESS_COOKIE = SESSION_COOKIES.access;
export const REFRESH_COOKIE = SESSION_COOKIES.refresh;
/** Stored for RP-initiated logout `id_token_hint` (silent end-session). */
export const ID_TOKEN_COOKIE = SESSION_COOKIES.idToken;
export const PKCE_COOKIE = SESSION_COOKIES.pkce;
export const STATE_COOKIE = SESSION_COOKIES.state;

export { sessionCookieOptions } from '@ticket/web-session';

export async function readAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACCESS_COOKIE)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(REFRESH_COOKIE)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readSubject(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(WEB_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ID_TOKEN_COOKIE);
  jar.delete(PKCE_COOKIE);
  jar.delete(STATE_COOKIE);
  jar.delete(WEB_AUTH_COOKIES.subject);
}
