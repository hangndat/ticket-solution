/**
 * Demo media catalog keys (D9 / brand/demo/manifest.json).
 * Bundled raster sources live in demo-media-assets.ts (Metro require).
 * Explicit fixture event ids only — never a fallback for published/MinIO URLs.
 *
 * Do not key EventBanner off tenantSlug: prod published seed reuses
 * `mfest-demo` / `demo-studio` and would force the old bundled banner.png
 * over the solid brand + initial fallback.
 */

/** Fixture event ids that ship local logo+banner. */
const DEMO_MEDIA_EVENT_IDS = new Set([
  'demo-mfest',
  'demo-studio-night',
]);

/** Stable demo event UUIDs from brand/demo/manifest.json (published seed). */
const DEMO_MEDIA_EVENT_UUIDS = new Set([
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222201',
]);

const DEMO_MEDIA_TENANT_SLUGS = new Set(['mfest-demo', 'demo-studio']);

export function hasDemoMediaForEventId(eventId: string | null | undefined): boolean {
  if (!eventId) return false;
  return DEMO_MEDIA_EVENT_IDS.has(eventId) || DEMO_MEDIA_EVENT_UUIDS.has(eventId);
}

export function hasDemoMediaForTenantSlug(
  tenantSlug: string | null | undefined,
): boolean {
  if (!tenantSlug) return false;
  return DEMO_MEDIA_TENANT_SLUGS.has(tenantSlug);
}
