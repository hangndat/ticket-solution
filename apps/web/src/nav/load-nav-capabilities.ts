'use client';

import { platformGet } from '../platform/client-fetch';
import {
  buildNavLinks,
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
  parsePlatformMeResponse,
  type NavCapabilities,
  type NavLink,
  GUEST_NAV_LINKS,
} from './capabilities';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Client discovery for SiteNav — deny-by-default until server capabilities resolve.
 * Does not persist staffEligible; ephemeral UI only (O02 contract §6).
 */
export async function loadNavCapabilities(): Promise<{
  caps: NavCapabilities;
  links: NavLink[];
}> {
  const [eventsResult, tenantsResult, platformResult] = await Promise.all([
    platformGet('/api/bff/me/events', REQUEST_TIMEOUT_MS),
    platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS),
    platformGet('/api/bff/platform/me', REQUEST_TIMEOUT_MS),
  ]);

  const meEvents = parseMeEventsResponse(
    eventsResult.status,
    eventsResult.json,
  );
  const meTenants = parseMeTenantsResponse(
    tenantsResult.status,
    tenantsResult.json,
  );
  const platformMe = parsePlatformMeResponse(
    platformResult.status,
    platformResult.json,
  );

  // Authenticated iff MeEvents or MeTenants returned a valid discovery payload.
  // Platform operator alone can still unlock Platform chrome via platformMe.
  const authenticated =
    meEvents !== null || meTenants !== null || platformMe !== null;

  const caps = deriveNavCapabilities({
    authenticated,
    meEvents,
    meTenants,
    platformMe,
  });

  return { caps, links: buildNavLinks(caps) };
}

export function guestNavLinks(): NavLink[] {
  return [...GUEST_NAV_LINKS];
}
