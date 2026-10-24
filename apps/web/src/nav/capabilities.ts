import type {
  MeEventItem,
  MeEventsResponse,
  MeTenantItem,
  MeTenantsResponse,
  PlatformMeResponse,
} from '../bff/platform-contracts';

/** Tenant permissions that unlock Quản trị chrome (handoff contract §3). */
export const ADMIN_TENANT_PERMISSIONS = [
  'event.create',
  'event.list',
  'members.manage',
  'tenant.profile',
] as const;

export type NavLink = {
  href: string;
  label: string;
  testId: string;
};

export type NavCapabilities = {
  authenticated: boolean;
  /** Staff / operator — portal CTA via GET /admin redirect (D-7). */
  showPortalStaff: boolean;
  showAccount: boolean;
};

/** Guest / deny-by-default chrome — never include staff routes. */
export const GUEST_NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Khám phá', testId: 'nav-events' },
  { href: '/redeem', label: 'Đổi mã', testId: 'nav-redeem' },
  {
    href: '/api/auth/login?return=/account',
    label: 'Tài khoản',
    testId: 'nav-account',
  },
];

const PRODUCT_NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Khám phá', testId: 'nav-events' },
  { href: '/redeem', label: 'Đổi mã', testId: 'nav-redeem' },
  { href: '/wallet', label: 'Vé của tôi', testId: 'nav-wallet' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) return null;
    out.push(item);
  }
  return out;
}

function parseMeEventItem(value: unknown): MeEventItem | null {
  if (!isRecord(value)) return null;
  const tenantId = value.tenantId;
  const eventId = value.eventId;
  const name = value.name;
  const permissions = parsePermissions(value.permissions);
  if (
    typeof tenantId !== 'string' ||
    tenantId.trim().length === 0 ||
    typeof eventId !== 'string' ||
    eventId.trim().length === 0 ||
    typeof name !== 'string' ||
    permissions === null
  ) {
    return null;
  }
  return { tenantId, eventId, name, permissions };
}

/** Fail-closed parse — invalid shape → null (treat as not eligible). */
export function parseMeEventsResponse(
  status: number,
  body: unknown,
): MeEventsResponse | null {
  if (status !== 200 || !isRecord(body)) return null;
  if (typeof body.staffEligible !== 'boolean') return null;
  if (!Array.isArray(body.items)) return null;
  const items: MeEventItem[] = [];
  for (const raw of body.items) {
    const item = parseMeEventItem(raw);
    if (!item) return null;
    items.push(item);
  }
  return { staffEligible: body.staffEligible, items };
}

function parseMeTenantItem(value: unknown): MeTenantItem | null {
  if (!isRecord(value)) return null;
  const tenantPermissions = parsePermissions(value.tenantPermissions);
  if (
    typeof value.tenantId !== 'string' ||
    typeof value.slug !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.role !== 'string' ||
    tenantPermissions === null
  ) {
    return null;
  }
  return {
    tenantId: value.tenantId,
    slug: value.slug,
    name: value.name,
    status: value.status as MeTenantItem['status'],
    role: value.role as MeTenantItem['role'],
    tenantPermissions,
  };
}

export function parseMeTenantsResponse(
  status: number,
  body: unknown,
): MeTenantsResponse | null {
  if (status !== 200 || !isRecord(body) || !Array.isArray(body.items)) {
    return null;
  }
  const items: MeTenantItem[] = [];
  for (const raw of body.items) {
    const item = parseMeTenantItem(raw);
    if (!item) return null;
    items.push(item);
  }
  return { items };
}

export function parsePlatformMeResponse(
  status: number,
  body: unknown,
): PlatformMeResponse | null {
  if (status !== 200 || !isRecord(body)) return null;
  if (typeof body.operator !== 'boolean') return null;
  if (!Array.isArray(body.permittedCommands)) return null;
  if (body.assurance !== 'mfa' && body.assurance !== 'missing') return null;
  const permittedCommands: string[] = [];
  for (const item of body.permittedCommands) {
    if (typeof item !== 'string') return null;
    permittedCommands.push(item);
  }
  return {
    operator: body.operator,
    permittedCommands,
    assurance: body.assurance,
  };
}

/**
 * Derive SiteNav chrome from server discovery only.
 * Missing / invalid payloads → deny staff chrome (O02 deny-by-default).
 */
export function deriveNavCapabilities(input: {
  authenticated: boolean;
  meEvents: MeEventsResponse | null;
  meTenants: MeTenantsResponse | null;
  platformMe: PlatformMeResponse | null;
}): NavCapabilities {
  if (!input.authenticated) {
    return {
      authenticated: false,
      showPortalStaff: false,
      showAccount: false,
    };
  }

  const staffEligible = input.meEvents?.staffEligible === true;

  const showPortalStaff =
    input.platformMe?.operator === true ||
    (staffEligible &&
      (input.meTenants?.items.some((tenant) =>
        tenant.tenantPermissions.some((perm) =>
          (ADMIN_TENANT_PERMISSIONS as readonly string[]).includes(perm),
        ),
      ) ??
        false));

  return {
    authenticated: true,
    showPortalStaff,
    showAccount: true,
  };
}

export function buildNavLinks(caps: NavCapabilities): NavLink[] {
  if (!caps.authenticated) return [...GUEST_NAV_LINKS];

  const links: NavLink[] = [...PRODUCT_NAV_LINKS];
  if (caps.showPortalStaff) {
    links.push({
      href: '/admin',
      label: 'Quản trị tổ chức',
      testId: 'nav-portal-staff',
    });
  }
  if (caps.showAccount) {
    links.push({ href: '/account', label: 'Tài khoản', testId: 'nav-account' });
  }
  // Logged-in chrome: Tài khoản replaces «Đăng nhập» — avoid duplicate login CTA.
  return links;
}
