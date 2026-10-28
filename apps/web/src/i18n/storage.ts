import {
  DEFAULT_ATTENDEE_LOCALE,
  parseAttendeeLocale,
  type AttendeeLocale,
} from './locale';

/** Cookie + localStorage — product host only; not marketing `/en`. */
export const ATTENDEE_LOCALE_STORAGE_KEY = 'vemoki_attendee_locale';

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
    return localStorage.getItem(ATTENDEE_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocal(value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ATTENDEE_LOCALE_STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredAttendeeLocale(): AttendeeLocale {
  const fromCookie = readCookie(ATTENDEE_LOCALE_STORAGE_KEY);
  if (fromCookie) return parseAttendeeLocale(fromCookie);
  const fromLocal = readLocal();
  if (fromLocal) return parseAttendeeLocale(fromLocal);
  return DEFAULT_ATTENDEE_LOCALE;
}

export function writeStoredAttendeeLocale(locale: AttendeeLocale): void {
  writeCookie(ATTENDEE_LOCALE_STORAGE_KEY, locale);
  writeLocal(locale);
}
