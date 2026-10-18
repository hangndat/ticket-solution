import { cookies } from 'next/headers';
import {
  PLATFORM_SESSION_COOKIES,
  SESSION_COOKIES,
} from '@ticket/web-session';
import {
  PLATFORM_AUTH_COOKIES,
  PORTAL_AUTH_COOKIES,
} from './local-cookies';

export {
  SESSION_COOKIES,
  PLATFORM_SESSION_COOKIES,
  sessionCookieOptions,
} from '@ticket/web-session';

export async function readStaffAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIES.access)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readStaffRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIES.refresh)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readStaffIdToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIES.idToken)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readStaffSubject(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PORTAL_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function clearStaffSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIES.access);
  jar.delete(SESSION_COOKIES.refresh);
  jar.delete(SESSION_COOKIES.idToken);
  jar.delete(SESSION_COOKIES.pkce);
  jar.delete(SESSION_COOKIES.state);
  jar.delete(SESSION_COOKIES.returnPath);
  jar.delete(PORTAL_AUTH_COOKIES.nonce);
  jar.delete(PORTAL_AUTH_COOKIES.subject);
}

export async function readPlatformAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PLATFORM_SESSION_COOKIES.access)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readPlatformRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PLATFORM_SESSION_COOKIES.refresh)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function readPlatformIdToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PLATFORM_AUTH_COOKIES.idToken)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function clearPlatformSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(PLATFORM_SESSION_COOKIES.access);
  jar.delete(PLATFORM_SESSION_COOKIES.refresh);
  jar.delete(PLATFORM_SESSION_COOKIES.pkce);
  jar.delete(PLATFORM_SESSION_COOKIES.state);
  jar.delete(PLATFORM_AUTH_COOKIES.nonce);
  jar.delete(PLATFORM_AUTH_COOKIES.subject);
  jar.delete(PLATFORM_AUTH_COOKIES.idToken);
}
