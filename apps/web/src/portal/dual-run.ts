/**
 * ADR-20 §8 / D-7 cutover: GET/HEAD `/admin` and `/platform` on apps/web
 * redirect to PORTAL_ORIGIN when configured (legacy routes removed).
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

/** Legacy `apps/web` admin workspace jobs (`admin-form.tsx`). */
export const LEGACY_ADMIN_JOBS = [
  'setup',
  'guests',
  'gate',
  'support',
] as const;

export type LegacyAdminJob = (typeof LEGACY_ADMIN_JOBS)[number];

/**
 * Guest job sub-tabs on portal (`guests/page.tsx` hash keys).
 * Legacy web uses overlapping sections under job=guests.
 */
export const LEGACY_ADMIN_GUEST_TABS = [
  'import',
  'pending',
  'notifications',
  'export',
] as const;

/** Setup job sub-routes on portal (types/sources/quota/config). */
export const LEGACY_ADMIN_SETUP_TABS = [
  'setup',
  'types',
  'sources',
  'quota',
  'config',
] as const;

/** Tenant-scoped tabs when no eventId (portal routes). */
export const LEGACY_ADMIN_TENANT_TABS = [
  'members',
  'settings',
  'events',
  'analytics',
] as const;

/** Migration `intent` query values → portal path suffix. */
export const LEGACY_ADMIN_INTENTS = ['onboarding', 'create-event'] as const;

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_INTENT = /^[A-Za-z0-9_-]{1,64}$/;

const LEGACY_JOB_SET = new Set<string>(LEGACY_ADMIN_JOBS);
const GUEST_TAB_SET = new Set<string>(LEGACY_ADMIN_GUEST_TABS);
const SETUP_TAB_SET = new Set<string>(LEGACY_ADMIN_SETUP_TABS);
const TENANT_TAB_SET = new Set<string>(LEGACY_ADMIN_TENANT_TABS);
const INTENT_SET = new Set<string>(LEGACY_ADMIN_INTENTS);

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

/** Redirect when PORTAL_ORIGIN is valid (D-7: unconditional; flag ignored). */
export function isAdminToPortalRedirectEnabled(
  env: DualRunEnv = process.env,
): boolean {
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

function migrationQueryRecord(search: string): Record<MigrationQueryKey, string | null> {
  const filtered = filterMigrationSearch(search);
  const raw = filtered.startsWith('?') ? filtered.slice(1) : filtered;
  const input = new URLSearchParams(raw);
  const out: Record<MigrationQueryKey, string | null> = {
    tenantId: null,
    eventId: null,
    intent: null,
    tab: null,
    job: null,
  };
  for (const key of MIGRATION_QUERY_ALLOWLIST) {
    out[key] = input.get(key);
  }
  return out;
}

function segment(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Map legacy GET/HEAD `/admin` (+ allowlisted query) to portal pathname (+ optional `#hash`).
 * `/platform` → `/platform`. Unknown job/tab values are ignored (safe fallback paths).
 */
export function mapLegacyAdminToPortalPath(input: {
  pathname: string;
  search?: string;
}): string {
  const pathname = input.pathname || '/';

  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    return '/platform';
  }

  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
    return '/';
  }

  const q = migrationQueryRecord(input.search ?? '');
  const tenantId = q.tenantId?.trim() ?? '';
  const eventId = q.eventId?.trim() ?? '';
  const job = q.job?.trim() ?? '';
  const tab = q.tab?.trim() ?? '';
  const intent = q.intent?.trim() ?? '';

  if (intent && INTENT_SET.has(intent)) {
    if (intent === 'onboarding') {
      return tenantId
        ? `/onboarding/${segment(tenantId)}`
        : '/onboarding';
    }
    if (intent === 'create-event' && tenantId) {
      return `/t/${segment(tenantId)}/events/new`;
    }
  }

  if (!tenantId) {
    return '/';
  }

  if (!eventId) {
    if (tab && TENANT_TAB_SET.has(tab)) {
      if (tab === 'events') return `/t/${segment(tenantId)}/events`;
      if (tab === 'analytics') return `/t/${segment(tenantId)}/analytics`;
      return `/t/${segment(tenantId)}/${tab}`;
    }
    return `/t/${segment(tenantId)}`;
  }

  const eventBase = `/t/${segment(tenantId)}/e/${segment(eventId)}`;

  if (!job) {
    if (tab && SETUP_TAB_SET.has(tab) && tab !== 'setup') {
      return `${eventBase}/${tab}`;
    }
    return eventBase;
  }

  if (!LEGACY_JOB_SET.has(job)) {
    return eventBase;
  }

  if (job === 'setup') {
    if (tab && SETUP_TAB_SET.has(tab)) {
      if (tab === 'setup') return `${eventBase}/setup`;
      return `${eventBase}/${tab}`;
    }
    return `${eventBase}/setup`;
  }

  if (job === 'guests') {
    if (tab && GUEST_TAB_SET.has(tab)) {
      return `${eventBase}/guests#${tab}`;
    }
    return `${eventBase}/guests`;
  }

  if (job === 'gate') {
    return `${eventBase}/gate`;
  }

  if (job === 'support') {
    if (tab === 'members') {
      return `/t/${segment(tenantId)}/members`;
    }
    return `${eventBase}/support`;
  }

  return eventBase;
}

/** Portal redirect target: fixed origin + mapped path (query consumed by mapper). */
export function portalMigrationLocation(
  origin: string,
  pathname: string,
  search?: string,
): string {
  const path = mapLegacyAdminToPortalPath({ pathname, search });
  return `${origin.replace(/\/$/, '')}${path}`;
}

export type AdminToPortalDecision =
  | { type: 'next' }
  | { type: 'redirect'; location: string; status: 302 }
  | { type: 'not_found' };

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
  const pathname = input.pathname || '/';

  if (!isNavigationMethod(input.method)) return { type: 'next' };
  if (!isAdminToPortalPath(pathname)) return { type: 'next' };

  const enabledExplicit = input.enabled;
  const enabled =
    enabledExplicit ?? isAdminToPortalRedirectEnabled(env);
  if (!enabled) {
    if (enabledExplicit === false) return { type: 'next' };
    return { type: 'not_found' };
  }

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
  if (!origin) return { type: 'not_found' };

  const dest = portalMigrationLocation(origin, pathname, input.search ?? '');
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
  return portalMigrationLocation(origin, safePath, search ?? '');
}
