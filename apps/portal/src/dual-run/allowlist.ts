/**
 * ADR-20 §5 / #438 — deep-link allowlist prep for portal dual-run.
 * Staff invite / migration links: path prefixes + safe query keys only.
 * Web /gate removed (D-6) — portal never deep-links /gate; block path here regardless.
 */

export const PORTAL_DEEPLINK_PATH_PREFIXES = [
  '/',
  '/admin',
  '/auth',
  '/platform',
  '/t',
  '/account',
] as const;

/** Query keys allowed on absolute portal deep-links (migration / email). */
export const PORTAL_DEEPLINK_QUERY_ALLOWLIST = [
  'tenantId',
  'eventId',
  'intent',
  'tab',
  'job',
] as const;

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_TOKENISH = /^[A-Za-z0-9_-]{1,64}$/;

export type PortalDeeplinkEnv = Readonly<Record<string, string | undefined>>;

export function portalOriginFromEnv(
  env: PortalDeeplinkEnv = process.env,
): string | null {
  const raw = (env.PORTAL_ORIGIN ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function productOriginFromEnv(
  env: PortalDeeplinkEnv = process.env,
): string {
  const raw = env.PRODUCT_ORIGIN?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:3000';
}

export function isPortalDeeplinkPath(pathname: string): boolean {
  if (pathname === '/gate' || pathname.startsWith('/gate/')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (pathname.includes('..') || pathname.startsWith('//')) return false;
  for (const prefix of PORTAL_DEEPLINK_PATH_PREFIXES) {
    if (prefix === '/') {
      if (pathname === '/') return true;
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function isAllowlistedValue(key: string, value: string): boolean {
  if (!value || value.length > 128) return false;
  if (key === 'tenantId' || key === 'eventId') return SAFE_ID.test(value);
  if (key === 'intent' || key === 'tab' || key === 'job')
    return SAFE_TOKENISH.test(value);
  return false;
}

export function filterPortalDeeplinkSearch(search: string): string {
  if (!search) return '';
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  const input = new URLSearchParams(raw);
  const out = new URLSearchParams();
  for (const key of PORTAL_DEEPLINK_QUERY_ALLOWLIST) {
    const value = input.get(key);
    if (value !== null && isAllowlistedValue(key, value)) {
      out.set(key, value);
    }
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Build an absolute portal deep-link. Rejects open redirects and /gate.
 * Returns null when PORTAL_ORIGIN missing or path not allowlisted.
 */
export function buildPortalDeeplink(
  path: string,
  search?: string,
  env: PortalDeeplinkEnv = process.env,
): string | null {
  const origin = portalOriginFromEnv(env);
  if (!origin) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (!isPortalDeeplinkPath(path)) return null;
  return `${origin}${path}${filterPortalDeeplinkSearch(search ?? '')}`;
}

/** Banner when PRODUCT_ORIGIN is set (legacy app still available). */
export function isPortalDualRunBannerEnabled(
  env: PortalDeeplinkEnv = process.env,
): boolean {
  const raw = env.PORTAL_DUAL_RUN_BANNER;
  if (raw !== undefined && raw.trim() !== '') {
    const v = raw.trim().toLowerCase();
    if (['0', 'false', 'off', 'no'].includes(v)) return false;
    if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  }
  // Default ON during prep when product origin is configured.
  return Boolean(env.PRODUCT_ORIGIN?.trim());
}
