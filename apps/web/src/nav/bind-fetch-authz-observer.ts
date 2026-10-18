'use client';

import { subscribeFetchJsonResult } from '../redeem/fetch-json';
import { navCapabilitiesStore } from './nav-capabilities-store';

let bound = false;

/** Discovery probes — 401 here is normal for guests; do not treat as revoke. */
const DISCOVERY_PATH_MARKERS = [
  '/api/bff/me/events',
  '/api/bff/me/tenants',
  '/api/bff/platform/me',
] as const;

export function isNavDiscoveryRequestUrl(requestUrl: string): boolean {
  return DISCOVERY_PATH_MARKERS.some((marker) => requestUrl.includes(marker));
}

/**
 * Wire BFF fetchJson results → SEC-CACHE nav clear (once per browser bundle).
 * Safe to call from SiteNav mount; idempotent.
 */
export function bindNavCapabilitiesAuthzObserver(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  subscribeFetchJsonResult((result, requestUrl) => {
    if (result.timedOut || result.networkError) return;
    if (isNavDiscoveryRequestUrl(requestUrl)) return;
    navCapabilitiesStore.handleAuthzDenial(result.status, result.json);
  });
}
