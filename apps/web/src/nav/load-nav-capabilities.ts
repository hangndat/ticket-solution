'use client';

import { platformGet } from '../bff/same-origin-fetch';
import { GUEST_NAV_LINKS, type NavCapabilities, type NavLink } from './capabilities';
import { resolveNavCapabilitiesFromUpstream } from './resolve-nav-capabilities';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Client discovery for SiteNav — deny-by-default until server capabilities resolve.
 * Does not persist staffEligible; ephemeral UI only (O02 contract §6).
 */
export async function loadNavCapabilities(): Promise<{
  caps: NavCapabilities;
  links: NavLink[];
}> {
  const [eventsResult, tenantsResult] = await Promise.all([
    platformGet('/api/bff/me/events', REQUEST_TIMEOUT_MS),
    platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS),
  ]);

  return resolveNavCapabilitiesFromUpstream(
    { status: eventsResult.status, body: eventsResult.json },
    { status: tenantsResult.status, body: tenantsResult.json },
  );
}

export function guestNavLinks(): NavLink[] {
  return [...GUEST_NAV_LINKS];
}
