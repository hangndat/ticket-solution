import { t } from '../copy';
import {
  marketingOriginFromEnv,
  productOriginFromEnv,
  type MarketingLocale,
} from '../hosts';

type JsonLd = Record<string, unknown>;

function scriptJsonLd(data: JsonLd | JsonLd[]) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function MarketingJsonLd({ locale }: { locale: MarketingLocale }) {
  const site = marketingOriginFromEnv().replace(/\/$/, '');
  const app = productOriginFromEnv().replace(/\/$/, '');
  const name = 'Vemoki';
  const description = t(locale, 'meta.description');

  const organization: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: site,
    logo: `${site}/icon.png`,
  };

  const website: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: site,
    description,
    inLanguage: locale === 'en' ? 'en' : 'vi',
  };

  const software: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: app,
    description,
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/OnlineOnly',
      description:
        locale === 'en'
          ? 'Contact for platform pricing — no public list price.'
          : 'Liên hệ để biết giá nền tảng — không công bố giá cố định.',
    },
  };

  return (
    <>
      {scriptJsonLd(organization)}
      {scriptJsonLd(website)}
      {scriptJsonLd(software)}
    </>
  );
}
