/** Portal navigation and direct-route policy, evaluated from server discovery codes. */
export const TENANT_ROUTES = {
  overview: ['event.create', 'event.list', 'members.manage', 'tenant.profile'],
  events: ['event.list'],
  'events/new': ['event.create'],
  members: ['members.manage'],
  settings: ['tenant.profile'],
} as const;

export const EVENT_ROUTES = {
  /** Dashboard loads report and catalog together; both server grants are required. */
  overview: ['event.config', 'report.read'],
  setup: ['event.update'],
  types: ['event.config'],
  sources: ['event.config'],
  quota: ['inventory.import'],
  config: ['event.config'],
  guests: [
    'inventory.import',
    'redemption.approve',
    'event.config',
    'export.create',
    'export.download',
  ],
  gate: ['report.read'],
  audit: [
    'report.read',
    'inventory.import',
    'export.create',
    'export.download',
  ],
  support: ['cs.lookup'],
} as const;

export const EVENT_ACTIONS = {
  readReport: ['report.read'],
  readCodes: ['inventory.import'],
  lookupSupport: ['cs.lookup'],
  saveConfig: ['event.config'],
  createType: ['event.config'],
  createSource: ['event.config'],
  updateEvent: ['event.update'],
  publishConfig: ['event.publish'],
  importInventory: ['inventory.import'],
  approveRedemption: ['redemption.approve'],
  sendNotification: ['event.config'],
  createExport: ['export.create'],
  downloadExport: ['export.download'],
} as const;

export const TENANT_ACTIONS = {
  createEvent: ['event.create'],
  listEvents: ['event.list'],
  manageMembers: ['members.manage'],
  editSettings: ['tenant.profile'],
} as const;

export function hasAnyPermission(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  return required.some((permission) => granted.includes(permission));
}

export function canAccessTenantRoute(
  route: keyof typeof TENANT_ROUTES | 'analytics',
  tenantPermissions: readonly string[],
  eventPermissions: readonly (readonly string[])[] = [],
): boolean {
  return route === 'analytics'
    ? eventPermissions.some((permissions) =>
        permissions.includes('report.read'),
      )
    : hasAnyPermission(tenantPermissions, TENANT_ROUTES[route]);
}

export function canAccessEventRoute(
  route: keyof typeof EVENT_ROUTES,
  permissions: readonly string[],
): boolean {
  if (route === 'overview') {
    return EVENT_ROUTES.overview.every((permission) =>
      permissions.includes(permission),
    );
  }
  return hasAnyPermission(permissions, EVENT_ROUTES[route]);
}

export function canPerformEventAction(
  action: keyof typeof EVENT_ACTIONS,
  permissions: readonly string[],
): boolean {
  return hasAnyPermission(permissions, EVENT_ACTIONS[action]);
}

export function canPerformTenantAction(
  action: keyof typeof TENANT_ACTIONS,
  permissions: readonly string[],
): boolean {
  return hasAnyPermission(permissions, TENANT_ACTIONS[action]);
}

/** Direct-link guard uses the same route table as the menu. */
export function canAccessPortalPath(
  pathname: string,
  context: {
    tenantId: string | null;
    tenantPermissions: readonly string[];
    eventId: string | null;
    eventPermissions: readonly string[];
    tenantEventPermissions: readonly (readonly string[])[];
  },
): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 't') return true;
  if (!context.tenantId || parts[1] !== context.tenantId) return false;
  if (parts[2] === 'e') {
    if (!context.eventId || parts[3] !== context.eventId) return false;
    const route = parts.slice(4).join('/') || 'overview';
    return (
      route in EVENT_ROUTES &&
      canAccessEventRoute(
        route as keyof typeof EVENT_ROUTES,
        context.eventPermissions,
      )
    );
  }
  const route = parts.slice(2).join('/') || 'overview';
  if (route === 'overview') {
    return (
      canAccessTenantRoute('overview', context.tenantPermissions) ||
      canAccessTenantRoute(
        'analytics',
        context.tenantPermissions,
        context.tenantEventPermissions,
      )
    );
  }
  if (route === 'analytics') {
    return canAccessTenantRoute(
      'analytics',
      context.tenantPermissions,
      context.tenantEventPermissions,
    );
  }
  return (
    route in TENANT_ROUTES &&
    canAccessTenantRoute(
      route as keyof typeof TENANT_ROUTES,
      context.tenantPermissions,
    )
  );
}

type DiscoveredEvent = {
  tenantId: string;
  eventId: string;
  permissions: readonly string[];
};

type DiscoveredTenant = {
  tenantId: string;
  tenantPermissions: readonly string[];
};

const EVENT_ENTRY_ROUTES = [
  'overview',
  'support',
  'gate',
  'audit',
  'guests',
  'setup',
  'config',
  'types',
  'sources',
  'quota',
] as const;

/** Choose an actual web route from discovery; role names never grant access. */
export function firstAllowedEventPath(event: DiscoveredEvent): string | null {
  const route = EVENT_ENTRY_ROUTES.find((candidate) =>
    canAccessEventRoute(candidate, event.permissions),
  );
  if (!route) return null;
  const base = `/t/${event.tenantId}/e/${event.eventId}`;
  return route === 'overview' ? base : `${base}/${route}`;
}

export function firstAllowedTenantPath(
  tenant: DiscoveredTenant,
  events: readonly DiscoveredEvent[],
): string | null {
  const tenantEvents = events.filter(
    (event) => event.tenantId === tenant.tenantId,
  );
  const eventPath = tenantEvents.map(firstAllowedEventPath).find(Boolean) ?? null;
  // Event-only staff land on their assigned event, not a denied tenant dashboard.
  if (!canAccessTenantRoute('overview', tenant.tenantPermissions)) {
    if (eventPath) return eventPath;
  }
  // event.create alone exposes the tenant overview, but an assigned event's
  // usable route is a better entry for staff without org management access.
  if (
    eventPath &&
    !tenantEvents.some(
      (event) => eventPath === `/t/${event.tenantId}/e/${event.eventId}`,
    ) &&
    !canAccessTenantRoute('events', tenant.tenantPermissions) &&
    !canAccessTenantRoute('members', tenant.tenantPermissions) &&
    !canAccessTenantRoute('settings', tenant.tenantPermissions)
  ) {
    return eventPath;
  }
  if (
    canAccessTenantRoute(
      'overview',
      tenant.tenantPermissions,
      tenantEvents.map((event) => event.permissions),
    ) ||
    canAccessTenantRoute(
      'analytics',
      tenant.tenantPermissions,
      tenantEvents.map((event) => event.permissions),
    )
  ) {
    return `/t/${tenant.tenantId}`;
  }
  return eventPath;
}
