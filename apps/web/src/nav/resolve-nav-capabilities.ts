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
  const authenticated = meEvents !== null || meTenants !== null;

  const caps = deriveNavCapabilities({
    authenticated,
    meEvents,
    meTenants,
    platformMe: null,
  });

  return { caps, links: buildNavLinks(caps) };
}
