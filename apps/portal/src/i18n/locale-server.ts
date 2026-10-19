import { cookies } from 'next/headers';
import {
  DEFAULT_PORTAL_LOCALE,
  parsePortalLocale,
  type PortalLocale,
} from './locale';
import { PORTAL_LOCALE_STORAGE_KEY } from './storage';

/** Pure helper — testable without Next request context. */
export function portalLocaleFromCookieValue(
  value: string | undefined | null,
): PortalLocale {
  if (value == null || value === '') return DEFAULT_PORTAL_LOCALE;
  return parsePortalLocale(value);
}

/** SSR: resolve `<html lang>` from `vemoki_portal_locale` request cookie. */
export async function readPortalLocaleFromServerCookies(): Promise<PortalLocale> {
  const jar = await cookies();
  return portalLocaleFromCookieValue(jar.get(PORTAL_LOCALE_STORAGE_KEY)?.value);
}
