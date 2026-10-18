/**
 * Bundled D9 demo raster assets under /public/demo/ (from brand/vemoki pack).
 * Explicit fixture catalog only — never a fallback for published/MinIO URLs.
 */

export const DEMO_LOGO_PATH = '/demo/logo.png';
export const DEMO_BANNER_PATH = '/demo/banner.png';

/** Archived web marketing fixture ids (`src/fixtures/archived-demo-events.ts`). */
const WEB_DEMO_EVENT_IDS = new Set([
  'fixture-fun-fest',
  'fixture-form-forum',
]);

/** Mobile / seed fixture ids (brand/demo/manifest.json + demo-events). */
const SEED_DEMO_EVENT_IDS = new Set([
  'demo-fun-fest',
  'demo-studio-night',
]);

/** Stable demo event UUIDs from brand/demo/manifest.json (published seed). */
const DEMO_MEDIA_EVENT_UUIDS = new Set([
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222201',
]);

const DEMO_MEDIA_TENANT_SLUGS = new Set([
  'sunburst',
  'northline',
  'demo-fun',
  'demo-studio',
]);

export type DemoMediaPack = {
  logoUrl: string;
  bannerUrl: string;
};

export function hasDemoMediaForEventId(
  eventId: string | null | undefined,
): boolean {
  if (!eventId) return false;
  return (
    WEB_DEMO_EVENT_IDS.has(eventId) ||
    SEED_DEMO_EVENT_IDS.has(eventId) ||
    DEMO_MEDIA_EVENT_UUIDS.has(eventId)
  );
}

/**
 * Local public paths for known demo fixtures.
 * Returns null for unknown ids — callers must not invent remote URLs.
 */
export function demoMediaForEventId(
  eventId: string | null | undefined,
): DemoMediaPack | null {
  if (!hasDemoMediaForEventId(eventId)) return null;
  return { logoUrl: DEMO_LOGO_PATH, bannerUrl: DEMO_BANNER_PATH };
}

export function demoMediaForTenantSlug(
  tenantSlug: string | null | undefined,
): DemoMediaPack | null {
  if (!tenantSlug || !DEMO_MEDIA_TENANT_SLUGS.has(tenantSlug)) return null;
  return { logoUrl: DEMO_LOGO_PATH, bannerUrl: DEMO_BANNER_PATH };
}

/**
 * Prefer allowlisted https / root-relative URL; otherwise null.
 * Mirrors branding sanitize rules for media surfaces.
 */
export function sanitizeMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > 2048) return null;
  if (s.startsWith('/')) {
    if (s.startsWith('//') || s.includes('\\') || s.includes('..')) return null;
    return s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}
