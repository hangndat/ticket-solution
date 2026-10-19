import {
  DEFAULT_PORTAL_LOCALE,
  parsePortalLocale,
  type PortalLocale,
} from './locale';

/** Cookie + localStorage key — user/org pref wave-1 (no BE schema). */
export const PORTAL_LOCALE_STORAGE_KEY = 'vemoki_portal_locale';

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rest.join('=') || '');
    }
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function readLocal(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(PORTAL_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocal(value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PORTAL_LOCALE_STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Resolve preference: cookie → localStorage → default VI.
 * Safe on server (returns default).
 */
export function readStoredPortalLocale(): PortalLocale {
  const fromCookie = readCookie(PORTAL_LOCALE_STORAGE_KEY);
  if (fromCookie) return parsePortalLocale(fromCookie);
  const fromLocal = readLocal();
  if (fromLocal) return parsePortalLocale(fromLocal);
  return DEFAULT_PORTAL_LOCALE;
}

/** Persist to cookie + localStorage so reload keeps preference (AC-C1). */
export function writeStoredPortalLocale(locale: PortalLocale): void {
  writeCookie(PORTAL_LOCALE_STORAGE_KEY, locale);
  writeLocal(locale);
}
