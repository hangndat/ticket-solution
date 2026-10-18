import type {
  MeEventsResponse,
  MeTenantItem,
  MeTenantsResponse,
  PlatformMeResponse,
} from '@ticket/contracts';

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

export function buildOrgMenuItems(
  tenantId: string,
  tenant: MeTenantItem | null,
): OrgMenuItem[] {
  if (!tenant || !tenantHasAdminChrome(tenant)) return [];
  const base = `/t/${tenantId}`;
  const items: OrgMenuItem[] = [
    { key: 'overview', href: base, label: 'Tổng quan tổ chức' },
  ];
  if (tenant.tenantPermissions.includes('event.list')) {
    items.push({
      key: 'events',
      href: `${base}/events`,
      label: 'Sự kiện',
      permission: 'event.list',
    });
  }
  if (tenant.tenantPermissions.includes('members.manage')) {
    items.push({
      key: 'members',
      href: `${base}/members`,
      label: 'Thành viên',
      permission: 'members.manage',
    });
  }
  if (tenant.tenantPermissions.includes('tenant.profile')) {
    items.push({
      key: 'settings',
      href: `${base}/settings`,
      label: 'Cấu hình',
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
): EventMenuItem[] {
  const base = `/t/${tenantId}/e/${eventId}`;
  const items: EventMenuItem[] = [
    { key: 'overview', href: base, label: 'Tổng quan' },
  ];
  if (
    permissions.some((p) =>
      ['event.update', 'config.publish', 'inventory.import'].includes(p),
    )
  ) {
    items.push({ key: 'setup', href: `${base}/setup`, label: 'Chuẩn bị' });
  }
  if (
    permissions.some((p) =>
      ['inventory.import', 'redemption.approve', 'notify.send'].includes(p),
    )
  ) {
    items.push({ key: 'guests', href: `${base}/guests`, label: 'Khách & mã' });
  }
  if (permissions.includes('report.read')) {
    items.push({
      key: 'gate',
      href: `${base}/gate`,
      label: 'Cổng',
      permission: 'report.read',
    });
  }
  if (permissions.includes('cs.lookup')) {
    items.push({
      key: 'support',
      href: `${base}/support`,
      label: 'Hỗ trợ',
      permission: 'cs.lookup',
    });
  }
  return items;
}
