import type {
  MeEventItem,
  MeEventsResponse,
  MeTenantItem,
  MeTenantsResponse,
  PlatformMeResponse,
} from '@ticket/contracts';
import type { MessageKey } from '../i18n/messages';
import { canAccessEventRoute, canAccessTenantRoute } from './capability-policy';

/** Message translator injected by UI (`usePortalLocale().t`) or tests. */
export type PortalTranslate = (key: MessageKey) => string;

export type PortalShellCapabilities = {
  authenticated: boolean;
  staffEligible: boolean;
  showOrgChrome: boolean;
  /** report.read on any event — Gate report nav (not scan). */
  showGateReport: boolean;
  /** gate.confirm — show iOS scan hint in shell (no web /gate link). */
  showGateScanHint: boolean;
  showPlatform: boolean;
  showAccount: boolean;
};

export type OrgMenuItem = {
  key: string;
  href: string;
  label: string;
  permission?: string;
};

export type EventMenuGroup = 'run' | 'setup';

export type EventMenuItem = {
  key: string;
  href: string;
  label: string;
  /** Live ops sit under the event name; setup sits in its own group. */
  group: EventMenuGroup;
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
      showGateScanHint: false,
      showPlatform: false,
      showAccount: false,
    };
  }

  const staffEligible = input.meEvents?.staffEligible === true;
  const showOrgChrome =
    staffEligible &&
    (input.meTenants?.items.some((tenant) =>
      canAccessTenantRoute('overview', tenant.tenantPermissions),
    ) ??
      false);

  const showGateReport =
    staffEligible &&
    (input.meEvents?.items.some((event) =>
      event.permissions.includes('report.read'),
    ) ??
      false);

  const showGateScanHint =
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
    showGateScanHint,
    showPlatform: input.platformMe?.operator === true,
    showAccount: true,
  };
}

export function tenantHasAdminChrome(tenant: MeTenantItem): boolean {
  return canAccessTenantRoute('overview', tenant.tenantPermissions);
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
  return canAccessTenantRoute(
    'analytics',
    [],
    meEventItems(meEvents)
      .filter((event) => event.tenantId === tenantId)
      .map((event) => event.permissions),
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
  if (canAccessTenantRoute('events', tenant.tenantPermissions)) {
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
  if (canAccessTenantRoute('members', tenant.tenantPermissions)) {
    items.push({
      key: 'members',
      href: `${base}/members`,
      label: translate('nav.org.members'),
      permission: 'members.manage',
    });
  }
  if (canAccessTenantRoute('settings', tenant.tenantPermissions)) {
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
  const items: EventMenuItem[] = [];
  if (canAccessEventRoute('overview', permissions)) {
    items.push({
      key: 'overview',
      href: base,
      label: translate('nav.event.overview'),
      group: 'run',
    });
  }
  if (canAccessEventRoute('setup', permissions)) {
    items.push({
      key: 'setup',
      href: `${base}/setup`,
      label: translate('nav.event.setup'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('types', permissions)) {
    items.push({
      key: 'types',
      href: `${base}/types`,
      label: translate('nav.event.types'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('sources', permissions)) {
    items.push({
      key: 'sources',
      href: `${base}/sources`,
      label: translate('nav.event.sources'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('quota', permissions)) {
    items.push({
      key: 'quota',
      href: `${base}/quota`,
      label: translate('nav.event.quota'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('config', permissions)) {
    items.push({
      key: 'config',
      href: `${base}/config`,
      label: translate('nav.event.configPublish'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('guests', permissions)) {
    items.push({
      key: 'guests',
      href: `${base}/guests`,
      label: translate('nav.event.guests'),
      group: 'setup',
    });
  }
  if (canAccessEventRoute('gate', permissions)) {
    items.push({
      key: 'gate',
      href: `${base}/gate`,
      label: translate('nav.event.gate'),
      group: 'run',
      permission: 'report.read',
    });
  }
  if (canAccessEventRoute('audit', permissions)) {
    items.push({
      key: 'audit',
      href: `${base}/audit`,
      label: translate('nav.event.auditCodes'),
      group: 'run',
    });
  }
  if (canAccessEventRoute('support', permissions)) {
    items.push({
      key: 'support',
      href: `${base}/support`,
      label: translate('nav.event.support'),
      group: 'run',
      permission: 'cs.lookup',
    });
  }
  return items;
}
