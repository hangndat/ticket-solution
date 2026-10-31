import type { Metadata } from 'next';
import { t } from '../copy';
import {
  marketingOriginFromEnv,
  type MarketingLocale,
} from '../hosts';
import {
  journeyHref,
  privacyHref,
  salesHref,
  supportHref,
  type MarketingPageKind,
} from '../links';

export type { MarketingPageKind };

function pagePath(locale: MarketingLocale, kind: MarketingPageKind): string {
  if (kind === 'privacy') return privacyHref(locale);
  if (kind === 'support') return supportHref(locale);
  if (kind === 'journey') return journeyHref(locale);
  return salesHref(locale);
}

function hreflangAlternates(
  kind: MarketingPageKind,
  origin: string,
): Metadata['alternates'] {
  const base = origin.replace(/\/$/, '');
  const vi = `${base}${pagePath('vi', kind)}`;
  const en = `${base}${pagePath('en', kind)}`;
  return {
    canonical: vi,
    languages: {
      vi,
      en,
      'x-default': vi,
    },
  };
}

function ogImageUrl(origin: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/opengraph-image.png`;
}

export function marketingPageMetadata(input: {
  locale: MarketingLocale;
  pageKind: MarketingPageKind;
  title: string;
  description: string;
}): Metadata {
  const marketingOrigin = marketingOriginFromEnv();
  const image = ogImageUrl(marketingOrigin);

  return {
    metadataBase: new URL(marketingOrigin),
    title: input.title,
    description: input.description,
    robots: { index: true, follow: true },
    alternates: hreflangAlternates(input.pageKind, marketingOrigin),
    openGraph: {
      type: 'website',
      locale: input.locale === 'en' ? 'en_US' : 'vi_VN',
      alternateLocale: input.locale === 'en' ? ['vi_VN'] : ['en_US'],
      url: `${marketingOrigin.replace(/\/$/, '')}${pagePath(input.locale, input.pageKind)}`,
      siteName: 'Vemoki',
      title: input.title,
      description: input.description,
      images: [{ url: image, width: 1200, height: 630, alt: 'Vemoki' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

export function salesMetadata(locale: MarketingLocale): Metadata {
  return marketingPageMetadata({
    locale,
    pageKind: 'sales',
    title: t(locale, 'meta.title'),
    description: t(locale, 'meta.description'),
  });
}

export function privacyMetadata(locale: MarketingLocale): Metadata {
  return marketingPageMetadata({
    locale,
    pageKind: 'privacy',
    title: t(locale, 'privacy.title'),
    description: t(locale, 'privacy.intro'),
  });
}

export function supportMetadata(locale: MarketingLocale): Metadata {
  return marketingPageMetadata({
    locale,
    pageKind: 'support',
    title: t(locale, 'support.title'),
    description: t(locale, 'support.lead'),
  });
}
