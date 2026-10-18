/**
 * ADR-20 §8 dual-run prep: optional GET/HEAD navigation from legacy
 * `app./admin` (+ `/platform`) → fixed portal origin + query allowlist.
 * Default OFF — legacy admin stays until a separately authorized deploy.
 * Never redirect POST/PUT/PATCH/DELETE or `/api/*` BFF.
 */

export const DEFAULT_PORTAL_ORIGIN_LOCAL = 'http://127.0.0.1:3013';

/** Path prefixes eligible for migration redirect (not /gate, not /api). */
export const ADMIN_TO_PORTAL_PATH_PREFIXES = ['/admin', '/platform'] as const;

/**
 * Business query keys kept on migration redirect (ADR-20 §5).
 * Unknown keys are dropped — never copy raw tokens/PII.
 */
export const MIGRATION_QUERY_ALLOWLIST = [
  'tenantId',
  'eventId',
  'intent',
  'tab',
  'job',
] as const;

export type MigrationQueryKey = (typeof MIGRATION_QUERY_ALLOWLIST)[number];

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_INTENT = /^[A-Za-z0-9_-]{1,64}$/;

export type DualRunEnv = Readonly<Record<string, string | undefined>>;

export function portalOriginFromEnv(
  env: DualRunEnv = process.env,
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

/** Truthy: 1 | true | on | yes (case-insensitive). Default OFF when unset. */
export function isEnvFlagOn(
  raw: string | undefined,
  defaultOn = false,
): boolean {
  if (raw === undefined || raw.trim() === '') return defaultOn;
  const v = raw.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  return defaultOn;
}

/**
 * Redirect flag — ADR-20: mặc định OFF.
 * Requires a valid PORTAL_ORIGIN when enabled (else treat as OFF / no-op).
 */
export function isAdminToPortalRedirectEnabled(
  env: DualRunEnv = process.env,
): boolean {
  if (!isEnvFlagOn(env.PORTAL_ADMIN_REDIRECT, false)) return false;
  return portalOriginFromEnv(env) !== null;
}

/**
 * Dual-run banner — show when PORTAL_ORIGIN is set and banner not explicitly OFF.
 * Independent of redirect flag so staff see portal CTA while legacy still serves.
 */
export function isDualRunBannerEnabled(env: DualRunEnv = process.env): boolean {
  if (portalOriginFromEnv(env) === null) return false;
  return isEnvFlagOn(env.PORTAL_DUAL_RUN_BANNER, true);
}

export function isAdminToPortalPath(pathname: string): boolean {
  for (const prefix of ADMIN_TO_PORTAL_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isNavigationMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

function isAllowlistedQueryValue(key: string, value: string): boolean {
  if (!value || value.length > 128) return false;
  if (key === 'tenantId' || key === 'eventId') return SAFE_ID.test(value);
  if (key === 'intent' || key === 'tab' || key === 'job')
    return SAFE_INTENT.test(value);
  return false;
}

/**
 * Keep only allowlisted query pairs with safe values.
 * Drops `return`/`next`/`redirect` open-redirect vectors and unknown keys.
 */
export function filterMigrationSearch(search: string): string {
  if (!search) return '';
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  const input = new URLSearchParams(raw);
  const out = new URLSearchParams();
  for (const key of MIGRATION_QUERY_ALLOWLIST) {
    const value = input.get(key);
    if (value !== null && isAllowlistedQueryValue(key, value)) {
      out.set(key, value);
    }
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

export type AdminToPortalDecision =
  | { type: 'next' }
  | { type: 'redirect'; location: string; status: 302 };

/**
 * Pure decision for apps/web proxy. Call only on the product process.
 * Never redirects /gate or /api/* (path check).
 */
export function decideAdminToPortalRedirect(input: {
  method: string;
  pathname: string;
  search?: string;
  enabled?: boolean;
  portalOrigin?: string | null;
  env?: DualRunEnv;
}): AdminToPortalDecision {
  const env = input.env ?? process.env;
  const enabled =
    input.enabled ?? isAdminToPortalRedirectEnabled(env);
  if (!enabled) return { type: 'next' };

  if (!isNavigationMethod(input.method)) return { type: 'next' };

  const pathname = input.pathname || '/';
  if (!isAdminToPortalPath(pathname)) return { type: 'next' };

  // Defense in depth — never migrate API/BFF even if prefixes drift.
  if (pathname.startsWith('/api/') || pathname === '/api') {
    return { type: 'next' };
  }
  if (pathname === '/gate' || pathname.startsWith('/gate/')) {
    return { type: 'next' };
  }

  const origin =
    input.portalOrigin !== undefined
      ? input.portalOrigin
      : portalOriginFromEnv(env);
  if (!origin) return { type: 'next' };

  const filtered = filterMigrationSearch(input.search ?? '');
  const dest = `${origin.replace(/\/$/, '')}${pathname}${filtered}`;
  return { type: 'redirect', location: dest, status: 302 };
}

/** Absolute portal href for banner CTA (path must be allowlisted prefix). */
export function portalHref(
  path: string,
  search: string | undefined,
  env: DualRunEnv = process.env,
): string | null {
  const origin = portalOriginFromEnv(env);
  if (!origin) return null;
  const safePath =
    path.startsWith('/') && !path.startsWith('//') && isAdminToPortalPath(path)
      ? path
      : '/admin';
  return `${origin}${safePath}${filterMigrationSearch(search ?? '')}`;
}
