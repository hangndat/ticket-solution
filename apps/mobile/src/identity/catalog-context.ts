/**
 * Mobile Events baseline (O18): platform catalog via
 * `GET /v1/public/events` — no per-install tenant slug.
 *
 * Distinct from wallet `getTenantId()` (UUID for GET /v1/me/tickets).
 */

export type AppCatalogMisconfigReason = 'ok';

export function appCatalogMisconfigReason(): AppCatalogMisconfigReason {
  return 'ok';
}

export function isAppCatalogConfigured(): boolean {
  return true;
}

/** Coordinator/ops: reserved for future contract gaps; platform list is always wired. */
export function catalogPlatformContractGap(): string | null {
  return null;
}
