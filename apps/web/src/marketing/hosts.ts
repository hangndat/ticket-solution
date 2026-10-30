/**
 * O13 host split helpers (architect: docs/architecture/o13-marketing-app-subdomain.md).
 * Pure — safe for unit tests / proxy.
 */

export const DEFAULT_PRODUCT_ORIGIN = 'https://app.vemoki.com';
export const DEFAULT_MARKETING_ORIGIN = 'https://vemoki.com';
export const DEFAULT_MARKETING_HOSTS = ['vemoki.com', 'www.vemoki.com'];

/** Product paths that must not execute on the marketing apex — redirect to PRODUCT_ORIGIN. */
export const PRODUCT_PATH_PREFIXES = [
  '/auth',
  '/admin',
  '/platform',
  '/gate',
  '/redeem',
  '/claim',
  '/invite',
  '/account',
  '/t/',
  '/api/auth',
  '/api/bff',
  '/api/admin',
] as const;

export type MarketingLocale = 'vi' | 'en';

export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() ?? '';
  // Strip port
  return first.replace(/:\d+$/, '').toLowerCase();
}

export function marketingHostsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = env.MARKETING_HOSTS?.trim();
  if (!raw) return [...DEFAULT_MARKETING_HOSTS];
  return raw
    .split(',')
    .map((s) => normalizeHost(s))
    .filter(Boolean);
}

export function productOriginFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = (env.PRODUCT_ORIGIN ?? '').trim() || DEFAULT_PRODUCT_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_PRODUCT_ORIGIN;
  }
}

export function marketingOriginFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = (env.MARKETING_ORIGIN ?? '').trim() || DEFAULT_MARKETING_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_MARKETING_ORIGIN;
  }
}

export function isMarketingHost(
  host: string,
  hosts: string[] = marketingHostsFromEnv(),
): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return hosts.includes(h);
}

export function isWwwMarketingHost(host: string): boolean {
  return normalizeHost(host) === 'www.vemoki.com';
}

export function isProductPath(pathname: string): boolean {
  if (pathname === '/t' || pathname.startsWith('/t/')) return true;
  for (const prefix of PRODUCT_PATH_PREFIXES) {
    if (prefix.endsWith('/')) {
      if (pathname.startsWith(prefix)) return true;
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/**
 * Public marketing paths (locale + legal). Internal Next tree lives under /marketing.
 */
export function publicMarketingPathToInternal(
  pathname: string,
): { internal: string; locale: MarketingLocale } | null {
  if (pathname === '/' || pathname === '') {
    return { internal: '/marketing', locale: 'vi' };
  }
  if (pathname === '/en' || pathname === '/en/') {
    return { internal: '/marketing/en', locale: 'en' };
  }
  if (pathname === '/experience' || pathname === '/experience/') {
    return { internal: '/marketing/journey', locale: 'vi' };
  }
  if (pathname === '/en/experience' || pathname === '/en/experience/') {
    return { internal: '/marketing/en/journey', locale: 'en' };
  }
  if (pathname === '/privacy' || pathname === '/privacy/') {
    return { internal: '/marketing/privacy', locale: 'vi' };
  }
  if (pathname === '/en/privacy' || pathname === '/en/privacy/') {
    return { internal: '/marketing/en/privacy', locale: 'en' };
  }
  if (pathname === '/support' || pathname === '/support/') {
    return { internal: '/marketing/support', locale: 'vi' };
  }
  if (pathname === '/en/support' || pathname === '/en/support/') {
    return { internal: '/marketing/en/support', locale: 'en' };
  }
  if (pathname === '/api/marketing/interest') {
    return { internal: pathname, locale: 'vi' };
  }
  // Direct internal tree (local UAT without Host spoof)
  if (pathname === '/marketing' || pathname.startsWith('/marketing/')) {
    const locale: MarketingLocale = pathname.includes('/en') ? 'en' : 'vi';
    return { internal: pathname, locale };
  }
  return null;
}

export function demoHref(productOrigin: string): string {
  const base = productOrigin.replace(/\/$/, '');
  return `${base}/?demo=1`;
}

export function loginHref(productOrigin: string): string {
  const base = productOrigin.replace(/\/$/, '');
  return `${base}/auth`;
}

export function redeemHref(productOrigin: string): string {
  const base = productOrigin.replace(/\/$/, '');
  return `${base}/redeem`;
}

export type HostRoutingDecision =
  | { type: 'next'; surface?: undefined; locale?: undefined }
  | {
      type: 'next';
      surface: 'marketing';
      locale: MarketingLocale;
    }
  | {
      type: 'rewrite';
      pathname: string;
      locale: MarketingLocale;
      surface: 'marketing';
    }
  | { type: 'redirect'; location: string; status: 301 | 302 };

export function decideHostRouting(input: {
  host: string;
  pathname: string;
  search?: string;
  productOrigin?: string;
  marketingOrigin?: string;
  marketingHosts?: string[];
}): HostRoutingDecision {
  const host = normalizeHost(input.host);
  const pathname = input.pathname || '/';
  const search = input.search ?? '';
  const productOrigin = input.productOrigin ?? productOriginFromEnv();
  const marketingOrigin = input.marketingOrigin ?? marketingOriginFromEnv();
  const hosts = input.marketingHosts ?? marketingHostsFromEnv();

  // www → apex (canonical marketing)
  if (isWwwMarketingHost(host)) {
    const apex = marketingOrigin.replace(/\/$/, '');
    return {
      type: 'redirect',
      location: `${apex}${pathname}${search}`,
      status: 301,
    };
  }

  const onMarketing = isMarketingHost(host, hosts);

  if (onMarketing && isProductPath(pathname)) {
    const dest = productOrigin.replace(/\/$/, '');
    return {
      type: 'redirect',
      location: `${dest}${pathname}${search}`,
      status: 302,
    };
  }

  // Marketing public paths: always rewrite (privacy/support/en work on any host;
  // `/` only when marketing host so localhost product home stays intact).
  if (pathname === '/' || pathname === '') {
    if (onMarketing) {
      return {
        type: 'rewrite',
        pathname: '/marketing',
        locale: 'vi',
        surface: 'marketing',
      };
    }
    return { type: 'next' };
  }

  const mapped = publicMarketingPathToInternal(pathname);
  if (mapped) {
    // Avoid double-rewrite loop for /api/marketing/* — let it through
    if (mapped.internal.startsWith('/api/')) {
      return { type: 'next' };
    }
    // Already on internal tree — NextResponse.next + surface headers (no self-rewrite).
    if (pathname === '/marketing' || pathname.startsWith('/marketing/')) {
      return {
        type: 'next',
        surface: 'marketing',
        locale: mapped.locale,
      };
    }
    // Product host: `/privacy` is served from `app/privacy` (account chrome), not marketing rewrite.
    if (
      !onMarketing &&
      (pathname === '/privacy' ||
        pathname === '/privacy/' ||
        pathname === '/en/privacy' ||
        pathname === '/en/privacy/')
    ) {
      return { type: 'next' };
    }
    return {
      type: 'rewrite',
      pathname: mapped.internal,
      locale: mapped.locale,
      surface: 'marketing',
    };
  }

  return { type: 'next' };
}
