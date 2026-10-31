'use client';

import { platformGet } from '../bff/same-origin-fetch';
import {
  buildNavLinks,
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
  type NavCapabilities,
  type NavLink,
  GUEST_NAV_LINKS,
} from './capabilities';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Client discovery for SiteNav — deny-by-default until server capabilities resolve.
 * Does not persist staffEligible; ephemeral attendee chrome only (ADR-20).
 */
export async function loadNavCapabilities(): Promise<{
  caps: NavCapabilities;
  links: NavLink[];
}> {
  const [eventsResult, tenantsResult] = await Promise.all([
    platformGet('/api/bff/me/events', REQUEST_TIMEOUT_MS),
    platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS),
  ]);

  const meEvents = parseMeEventsResponse(
    eventsResult.status,
    eventsResult.json,
  );
  const meTenants = parseMeTenantsResponse(
    tenantsResult.status,
    tenantsResult.json,
  );
  const authenticated = meEvents !== null || meTenants !== null;

  const caps = deriveNavCapabilities({
    authenticated,
    meEvents,
    meTenants,
    platformMe: null,
  });

  return { caps, links: buildNavLinks(caps) };
}

export function guestNavLinks(): NavLink[] {
  return [...GUEST_NAV_LINKS];
}
