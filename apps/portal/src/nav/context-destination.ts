import {
  canAccessEventRoute,
  canAccessTenantRoute,
  firstAllowedEventPath,
  firstAllowedTenantPath,
  EVENT_ROUTES,
  TENANT_ROUTES,
} from './capability-policy';

type Tenant = { tenantId: string; tenantPermissions: readonly string[] };
type Event = {
  tenantId: string;
  eventId: string;
  permissions: readonly string[];
};
type Destination = { path: string; preserved: boolean } | null;

function eventSection(pathname: string): keyof typeof EVENT_ROUTES | null {
  const match = pathname.match(/^\/t\/[^/]+\/e\/[^/]+(?:\/(.*))?$/);
  if (!match) return null;
  const section = match[1] || 'overview';
  return section in EVENT_ROUTES
    ? (section as keyof typeof EVENT_ROUTES)
    : null;
}

function tenantSection(
  pathname: string,
): keyof typeof TENANT_ROUTES | 'analytics' | null {
  const match = pathname.match(/^\/t\/[^/]+(?:\/(.*))?$/);
  if (!match || match[1]?.startsWith('e/')) return null;
  const section = match[1] || 'overview';
  return section === 'analytics' || section in TENANT_ROUTES
    ? (section as keyof typeof TENANT_ROUTES | 'analytics')
    : null;
}

function eventPath(event: Event, section: keyof typeof EVENT_ROUTES): string {
  const base = `/t/${event.tenantId}/e/${event.eventId}`;
  return section === 'overview' ? base : `${base}/${section}`;
}

export function eventSwitchDestination(
  pathname: string,
  event: Event,
): Destination {
  const section = eventSection(pathname);
  if (section && canAccessEventRoute(section, event.permissions)) {
    return { path: eventPath(event, section), preserved: true };
  }
  const path = firstAllowedEventPath(event);
  return path ? { path, preserved: false } : null;
}

export function tenantSwitchDestination(
  pathname: string,
  tenant: Tenant,
  events: readonly Event[],
): Destination {
  const tenantEvents = events.filter(
    (event) => event.tenantId === tenant.tenantId,
  );
  const orgSection = tenantSection(pathname);
  const eventPermissions = tenantEvents.map((event) => event.permissions);
  if (
    orgSection &&
    (canAccessTenantRoute(
      orgSection,
      tenant.tenantPermissions,
      eventPermissions,
    ) ||
      (orgSection === 'overview' &&
        canAccessTenantRoute(
          'analytics',
          tenant.tenantPermissions,
          eventPermissions,
        )))
  ) {
    const base = `/t/${tenant.tenantId}`;
    return {
      path: orgSection === 'overview' ? base : `${base}/${orgSection}`,
      preserved: true,
    };
  }
  const section = eventSection(pathname);
  if (section) {
    const event = tenantEvents.find((item) =>
      canAccessEventRoute(section, item.permissions),
    );
    if (event) return { path: eventPath(event, section), preserved: true };
  }
  const path = firstAllowedTenantPath(tenant, events);
  return path ? { path, preserved: false } : null;
}
