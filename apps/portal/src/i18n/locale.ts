/** Portal UI locales — default VI (O04 / P2-LOCALE-ADDITIVE). */
export type PortalLocale = 'vi' | 'en';

export const DEFAULT_PORTAL_LOCALE: PortalLocale = 'vi';

export const PORTAL_LOCALES: readonly PortalLocale[] = ['vi', 'en'] as const;

export function isPortalLocale(value: unknown): value is PortalLocale {
  return value === 'vi' || value === 'en';
}

export function parsePortalLocale(
  value: unknown,
  fallback: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PortalLocale {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en_us') {
    return 'en';
  }
  if (normalized === 'vi' || normalized === 'vi-vn' || normalized === 'vi_vn') {
    return 'vi';
  }
  return fallback;
}
