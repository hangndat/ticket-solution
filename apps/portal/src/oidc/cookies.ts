import { cookies } from 'next/headers';
import {
  PLATFORM_SESSION_COOKIES,
  SESSION_COOKIES,
} from '@ticket/web-session';
import {
  PLATFORM_AUTH_COOKIES,
  PORTAL_AUTH_COOKIES,
  isStaffEpoch,
  staffTokenCookieName,
} from './local-cookies';

export {
  SESSION_COOKIES,
  PLATFORM_SESSION_COOKIES,
  sessionCookieOptions,
} from '@ticket/web-session';

export async function readStaffAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const epoch = jar.get(PORTAL_AUTH_COOKIES.epoch)?.value ?? '';
  const value = isStaffEpoch(epoch) ? jar.get(staffTokenCookieName(SESSION_COOKIES.access, epoch))?.value?.trim() ?? '' : '';
  return value.length > 0 ? value : null;
}

export async function readStaffRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const epoch = jar.get(PORTAL_AUTH_COOKIES.epoch)?.value ?? '';
  const value = isStaffEpoch(epoch) ? jar.get(staffTokenCookieName(SESSION_COOKIES.refresh, epoch))?.value?.trim() ?? '' : '';
  return value.length > 0 ? value : null;
}

export async function readStaffIdToken(): Promise<string | null> {
  const jar = await cookies();
  const epoch = jar.get(PORTAL_AUTH_COOKIES.epoch)?.value ?? '';
  const value = isStaffEpoch(epoch) ? jar.get(staffTokenCookieName(SESSION_COOKIES.idToken, epoch))?.value?.trim() ?? '' : '';
  return value.length > 0 ? value : null;
}

export async function readStaffSubject(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PORTAL_AUTH_COOKIES.subject)?.value?.trim() ?? '';
  return value.length > 0 ? value : null;
}

/** Remove current and legacy token names when a new callback or logout replaces a session. */
export async function clearStaffTokenCookies(): Promise<void> {
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if ([SESSION_COOKIES.access, SESSION_COOKIES.refresh, SESSION_COOKIES.idToken]
      .some((base) => cookie.name.startsWith(`${base}__`))) jar.delete(cookie.name);
  }
  jar.delete(SESSION_COOKIES.access);
  jar.delete(SESSION_COOKIES.refresh);
  jar.delete(SESSION_COOKIES.idToken);
}

export async function clearStaffSessionCookies(): Promise<void> {
  await clearStaffTokenCookies();
  const jar = await cookies();
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
