import type {
  MeEventItem,
  MeEventsResponse,
  MeTenantItem,
  MeTenantsResponse,
  PlatformMeResponse,
} from '@ticket/contracts';
import type { MessageKey } from '../i18n/messages';

/** Message translator injected by UI (`usePortalLocale().t`) or tests. */
export type PortalTranslate = (key: MessageKey) => string;

/** Tenant permissions that unlock org chrome (O02 / handoff §3.3). */
export const ADMIN_TENANT_PERMISSIONS = [
  'event.create',
  'event.list',
  'members.manage',
  'tenant.profile',
] as const;

export type PortalShellCapabilities = {
  authenticated: boolean;
  staffEligible: boolean;
  showOrgChrome: boolean;
  /** report.read on any event — Gate report nav (not scan). */
  showGateReport: boolean;
  /** gate.confirm — deep-link CTA to app./gate only. */
  showGateDeeplink: boolean;
  showPlatform: boolean;
  showAccount: boolean;
};

export type OrgMenuItem = {
  key: string;
  href: string;
  label: string;
  permission?: string;
};

export type EventMenuItem = {
  key: string;
  href: string;
  label: string;
  /** Server permission required; omit = visible when event in MeEvents. */
  permission?: string;
};

export function derivePortalShellCapabilities(input: {
  authenticated: boolean;
  meEvents: MeEventsResponse | null;
  meTenants: MeTenantsResponse | null;
  platformMe: PlatformMeResponse | null;
}): PortalShellCapabilities {
  if (!input.authenticated) {
    return {
      authenticated: false,
      staffEligible: false,
      showOrgChrome: false,
      showGateReport: false,
      showGateDeeplink: false,
      showPlatform: false,
      showAccount: false,
    };
  }

  const staffEligible = input.meEvents?.staffEligible === true;
  const showOrgChrome =
    staffEligible &&
    (input.meTenants?.items.some((tenant) =>
      tenant.tenantPermissions.some((perm) =>
        (ADMIN_TENANT_PERMISSIONS as readonly string[]).includes(perm),
      ),
    ) ??
      false);

  const showGateReport =
    staffEligible &&
    (input.meEvents?.items.some((event) =>
      event.permissions.includes('report.read'),
    ) ??
      false);

  const showGateDeeplink =
    staffEligible &&
    (input.meEvents?.items.some((event) =>
      event.permissions.includes('gate.confirm'),
    ) ??
      false);

  return {
    authenticated: true,
    staffEligible: staffEligible ?? false,
    showOrgChrome,
    showGateReport,
    showGateDeeplink,
    showPlatform: input.platformMe?.operator === true,
    showAccount: true,
  };
}

export function tenantHasAdminChrome(tenant: MeTenantItem): boolean {
  return tenant.tenantPermissions.some((perm) =>
    (ADMIN_TENANT_PERMISSIONS as readonly string[]).includes(perm),
  );
}

function meEventItems(
  meEvents: MeEventsResponse | null | undefined | readonly MeEventItem[],
): readonly MeEventItem[] {
  if (meEvents == null) return [];
  if ('items' in meEvents) return meEvents.items;
  return meEvents;
}

/**
 * P2 Analytics nav — ≥1 assigned event with report.read for this tenant.
 * Deny-by-default; never infer from role name.
 */
export function tenantHasAnalytics(
  tenantId: string,
  meEvents: MeEventsResponse | null | readonly MeEventItem[],
): boolean {
  return meEventItems(meEvents).some(
    (event) =>
      event.tenantId === tenantId &&
      event.permissions.includes('report.read'),
  );
}

export function buildOrgMenuItems(
  tenantId: string,
  tenant: MeTenantItem | null,
  meEvents: MeEventsResponse | null | readonly MeEventItem[] | undefined,
  translate: PortalTranslate,
): OrgMenuItem[] {
  if (!tenant) return [];
  const hasAdmin = tenantHasAdminChrome(tenant);
  const hasAnalytics = tenantHasAnalytics(tenantId, meEvents ?? null);
  if (!hasAdmin && !hasAnalytics) return [];

  const base = `/t/${tenantId}`;
  const items: OrgMenuItem[] = [
    { key: 'overview', href: base, label: translate('nav.org.overview') },
  ];
  if (hasAdmin && tenant.tenantPermissions.includes('event.list')) {
    items.push({
      key: 'events',
      href: `${base}/events`,
      label: translate('nav.org.events'),
      permission: 'event.list',
    });
  }
  if (hasAnalytics) {
    items.push({
      key: 'analytics',
      href: `${base}/analytics`,
      label: translate('nav.org.analytics'),
      permission: 'report.read',
    });
  }
  if (hasAdmin && tenant.tenantPermissions.includes('members.manage')) {
    items.push({
      key: 'members',
      href: `${base}/members`,
      label: translate('nav.org.members'),
      permission: 'members.manage',
    });
  }
  if (hasAdmin && tenant.tenantPermissions.includes('tenant.profile')) {
    items.push({
      key: 'settings',
      href: `${base}/settings`,
      label: translate('nav.org.settings'),
      permission: 'tenant.profile',
    });
  }
  return items;
}

/**
 * Event sider items — capability from server permissions only.
 * Gate report requires report.read; never gate.confirm alone.
 */
export function buildEventMenuItems(
  tenantId: string,
  eventId: string,
  permissions: readonly string[],
  translate: PortalTranslate,
): EventMenuItem[] {
  const base = `/t/${tenantId}/e/${eventId}`;
  const items: EventMenuItem[] = [
    { key: 'overview', href: base, label: translate('nav.event.overview') },
  ];
  const canSetup = permissions.some((p) =>
    ['event.update', 'config.publish', 'inventory.import', 'event.config'].includes(
      p,
    ),
  );
  if (canSetup) {
    items.push({ key: 'setup', href: `${base}/setup`, label: translate('nav.event.setup') });
    items.push({ key: 'types', href: `${base}/types`, label: translate('nav.event.types') });
    items.push({ key: 'sources', href: `${base}/sources`, label: translate('nav.event.sources') });
    items.push({ key: 'quota', href: `${base}/quota`, label: translate('nav.event.quota') });
    items.push({
      key: 'config',
      href: `${base}/config`,
      label: translate('nav.event.configPublish'),
    });
  }
  if (
    permissions.some((p) =>
      ['inventory.import', 'redemption.approve', 'notify.send'].includes(p),
    )
  ) {
    items.push({ key: 'guests', href: `${base}/guests`, label: translate('nav.event.guests') });
  }
  if (permissions.includes('report.read')) {
    items.push({
      key: 'gate',
      href: `${base}/gate`,
      label: translate('nav.event.gate'),
      permission: 'report.read',
    });
  }
  if (
    permissions.includes('report.read') ||
    permissions.includes('inventory.import')
  ) {
    items.push({
      key: 'audit',
      href: `${base}/audit`,
      label: translate('nav.event.auditCodes'),
    });
  }
  if (permissions.includes('cs.lookup')) {
    items.push({
      key: 'support',
      href: `${base}/support`,
      label: translate('nav.event.support'),
      permission: 'cs.lookup',
    });
  }
  return items;
}
