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

/** Switch locale keeping path kind + optional hash. */
export function localeSwitchHref(
  locale: MarketingLocale,
  kind: 'sales' | 'privacy' | 'support',
  hash = '',
): string {
  const base =
    kind === 'privacy'
      ? privacyHref(locale)
      : kind === 'support'
        ? supportHref(locale)
        : salesHref(locale);
  return hash ? `${base}${hash.startsWith('#') ? hash : `#${hash}`}` : base;
}
