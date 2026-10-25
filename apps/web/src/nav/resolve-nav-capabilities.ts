import {
  buildNavLinks,
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
  type NavCapabilities,
  type NavLink,
} from './capabilities';

export type UpstreamJsonResult = { status: number; body: unknown };

export function resolveNavCapabilitiesFromUpstream(
  eventsResult: UpstreamJsonResult,
  tenantsResult: UpstreamJsonResult,
): { caps: NavCapabilities; links: NavLink[] } {
  const meEvents = parseMeEventsResponse(
    eventsResult.status,
    eventsResult.body,
  );
  const meTenants = parseMeTenantsResponse(
    tenantsResult.status,
    tenantsResult.body,
  );
  // Keep the staff gate's discovery condition in both client and SSR chrome:
  // MeEvents alone cannot establish an attendee session when MeTenants failed.
  const authenticated = meTenants !== null;

  const caps = deriveNavCapabilities({
    authenticated,
    meEvents,
    meTenants,
    platformMe: null,
  });

  return { caps, links: buildNavLinks(caps) };
}
