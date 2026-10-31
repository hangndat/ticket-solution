import {
  isMarketingHost,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  normalizeHost,
  PRODUCT_PATH_PREFIXES,
} from '../hosts';
import { journeyHref, privacyHref, salesHref, supportHref, type MarketingPageKind } from '../links';
import { JOURNEY_INDEXABLE } from '../journey/publication';
import type { MarketingLocale } from '../hosts';

/** Paths that must never appear in marketing sitemap (not enumerated in robots.txt). */
export const PRIVATE_PATH_SEGMENTS = [
  '/auth',
  '/platform',
  '/account',
  '/claim',
  '/invite',
  '/redeem',
  '/t/',
  '/marketing',
  '/api/',
  '/dev/',
] as const;

/** Not listed in robots.txt (noindex on routes instead). */
const ROBOTS_OMIT_PRIVATE_SURFACE = new Set(['/admin', '/gate', '/wallet']);

export function marketingDisallowPaths(): string[] {
  const fromProduct = PRODUCT_PATH_PREFIXES.map((p) =>
    p.endsWith('/') ? p : p,
  );
  return [...new Set([...PRIVATE_PATH_SEGMENTS, ...fromProduct])].filter(
    (p) => !ROBOTS_OMIT_PRIVATE_SURFACE.has(p),
  );
}

export function isMarketingRequestHost(
  host: string,
  hosts = marketingHostsFromEnv(),
): boolean {
  return isMarketingHost(host, hosts);
}

export type RobotsPolicy = {
  rules: Array<{
    userAgent: string;
    allow?: string | string[];
    disallow?: string | string[];
  }>;
  sitemap?: string | string[];
  host?: string;
};

export function robotsForMarketingHost(
  marketingOrigin = marketingOriginFromEnv(),
): RobotsPolicy {
  const origin = marketingOrigin.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: marketingDisallowPaths(),
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: normalizeHost(new URL(origin).host) || 'vemoki.com',
  };
}

export function robotsForProductHost(): RobotsPolicy {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  };
}

export function resolveRobotsPolicy(hostHeader: string | null | undefined): RobotsPolicy {
  const host = normalizeHost(hostHeader);
  if (isMarketingRequestHost(host)) {
    return robotsForMarketingHost();
  }
  return robotsForProductHost();
}

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'weekly' | 'monthly';
  priority?: number;
  alternates?: { languages: Record<string, string> };
};

const MARKETING_LOCALES: MarketingLocale[] = ['vi', 'en'];

function publicPath(
  locale: MarketingLocale,
  kind: MarketingPageKind,
): string {
  if (kind === 'privacy') return privacyHref(locale);
  if (kind === 'support') return supportHref(locale);
  if (kind === 'journey') return journeyHref(locale);
  return salesHref(locale);
}

export function marketingSitemapEntries(
  marketingOrigin = marketingOriginFromEnv(),
): SitemapEntry[] {
  const base = marketingOrigin.replace(/\/$/, '');
  const kinds: MarketingPageKind[] = [
    'sales',
    'privacy',
    'support',
    ...(JOURNEY_INDEXABLE ? ['journey' as const] : []),
  ];
  const entries: SitemapEntry[] = [];
  for (const kind of kinds) {
    const viPath = publicPath('vi', kind);
    const enPath = publicPath('en', kind);
    const canonicalPath = viPath;
    const languages: Record<string, string> = {
      vi: `${base}${viPath}`,
      en: `${base}${enPath}`,
      'x-default': `${base}${canonicalPath}`,
    };
    for (const locale of MARKETING_LOCALES) {
      const path = publicPath(locale, kind);
      entries.push({
        url: `${base}${path}`,
        changeFrequency: kind === 'sales' ? 'weekly' : 'monthly',
        priority: kind === 'sales' ? 1 : 0.6,
        alternates: { languages },
      });
    }
  }
  return entries;
}

export function resolveSitemapEntries(
  hostHeader: string | null | undefined,
): SitemapEntry[] {
  const host = normalizeHost(hostHeader);
  if (!isMarketingRequestHost(host)) {
    return [];
  }
  return marketingSitemapEntries();
}
