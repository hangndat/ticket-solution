import {
  DEFAULT_PORTAL_LOCALE,
  parsePortalLocale,
  type PortalLocale,
} from './locale';

/** Match `storage.ts` Max-Age — 1 year. */
export const PORTAL_LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Parse POST /api/locale JSON `{ locale }` — unknown/missing → default VI (O04). */
export function portalLocaleFromJsonBody(body: unknown): PortalLocale {
  if (!body || typeof body !== 'object' || !('locale' in body)) {
    return DEFAULT_PORTAL_LOCALE;
  }
  return parsePortalLocale((body as { locale: unknown }).locale);
}

export function portalLocaleCookieOptions(secure: boolean): {
  path: '/';
  maxAge: number;
  sameSite: 'lax';
  httpOnly: false;
  secure: boolean;
} {
  return {
    path: '/',
    maxAge: PORTAL_LOCALE_COOKIE_MAX_AGE_SEC,
    sameSite: 'lax',
    // Readable by PortalLocaleProvider hydration (cookie → localStorage → VI).
    httpOnly: false,
    secure,
  };
}
