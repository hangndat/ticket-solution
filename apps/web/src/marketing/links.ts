import type { MarketingLocale } from './hosts';

/** Public marketing hrefs (locale-aware path prefix). */
export function salesHref(locale: MarketingLocale): string {
  return locale === 'en' ? '/en' : '/';
}

export function privacyHref(locale: MarketingLocale): string {
  return locale === 'en' ? '/en/privacy' : '/privacy';
}

export function supportHref(locale: MarketingLocale): string {
  return locale === 'en' ? '/en/support' : '/support';
}

/**
 * Public cinematic journey URLs; indexing remains gated separately.
 */
export function journeyHref(locale: MarketingLocale): string {
  return locale === 'en' ? '/en/experience' : '/experience';
}

export type MarketingPageKind = 'sales' | 'privacy' | 'support' | 'journey';

/** Switch locale keeping path kind + optional hash. */
export function localeSwitchHref(
  locale: MarketingLocale,
  kind: MarketingPageKind,
  hash = '',
): string {
  const base =
    kind === 'privacy'
      ? privacyHref(locale)
      : kind === 'support'
        ? supportHref(locale)
        : kind === 'journey'
          ? journeyHref(locale)
          : salesHref(locale);
  return hash ? `${base}${hash.startsWith('#') ? hash : `#${hash}`}` : base;
}
