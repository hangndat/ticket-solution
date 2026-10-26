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
    'notify.send',
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
  publishConfig: ['config.publish'],
  importInventory: ['inventory.import'],
  approveRedemption: ['redemption.approve'],
  sendNotification: ['notify.send', 'event.config'],
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
