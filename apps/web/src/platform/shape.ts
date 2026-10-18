import type {
  AccountDeletionRequestResponse,
  InviteCreatedResponse,
  MeTenantItem,
  MeTenantsResponse,
  MembershipRole,
  MeTenantRole,
  PlatformCreateTenantResponse,
  PlatformMeResponse,
  PlatformTenantDetail,
  SupportGrantResponse,
  SupportScope,
  TenantFlagsDto,
  TenantLimitsDto,
  TenantStatus,
} from './contracts';

export type ViewResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const PLATFORM_UNKNOWN =
  'Kết quả platform chưa biết. Không coi là đã thành công.';

function asRecord(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function apiError(
  body: Record<string, unknown> | null,
): { code: string; message: string } | null {
  if (!body || typeof body.code !== 'string' || !body.code.trim()) return null;
  return {
    code: body.code,
    message: typeof body.message === 'string' ? body.message : body.code,
  };
}

function isStatus(value: unknown): value is TenantStatus {
  return value === 'PENDING' || value === 'ACTIVE' || value === 'SUSPENDED';
}

function isRole(value: unknown): value is MeTenantRole {
  return (
    value === 'Owner' ||
    value === 'Manager' ||
    value === 'CS' ||
    value === 'Supervisor' ||
    value === 'Scanner' ||
    value === 'Attendee'
  );
}

function parseLimits(value: unknown): TenantLimitsDto | null {
  const body = asRecord(value);
  if (!body) return null;
  for (const key of [
    'maxEvents',
    'maxStaff',
    'emailPerDay',
    'importRowsPerJob',
  ] as const) {
    const v = body[key];
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) {
      return null;
    }
  }
  return {
    maxEvents: body.maxEvents as number | null,
    maxStaff: body.maxStaff as number | null,
    emailPerDay: body.emailPerDay as number | null,
    importRowsPerJob: body.importRowsPerJob as number | null,
  };
}

function parseFlags(value: unknown): TenantFlagsDto | null {
  const body = asRecord(value);
  if (!body) return null;
  if (
    typeof body.importsEnabled !== 'boolean' ||
    typeof body.exportsEnabled !== 'boolean'
  ) {
    return null;
  }
  return {
    importsEnabled: body.importsEnabled,
    exportsEnabled: body.exportsEnabled,
  };
}

function wrap<T>(
  status: number,
  json: unknown,
  networkError: boolean,
  parse: (body: Record<string, unknown>) => T | null,
  okStatuses: number[] = [200, 201, 202],
): ViewResult<T> {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: PLATFORM_UNKNOWN };
  }
  const body = asRecord(json);
  if (okStatuses.includes(status) && body) {
    const value = parse(body);
    if (value) return { kind: 'ok', value };
    return { kind: 'unknown', message: PLATFORM_UNKNOWN };
  }
  const err = apiError(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: PLATFORM_UNKNOWN };
}

export function interpretPlatformMe(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<PlatformMeResponse> {
  return wrap(status, json, networkError, (body) => {
    if (
      typeof body.operator !== 'boolean' ||
      !Array.isArray(body.permittedCommands) ||
      (body.assurance !== 'mfa' && body.assurance !== 'missing')
    ) {
      return null;
    }
    if (!body.permittedCommands.every((c) => typeof c === 'string')) {
      return null;
    }
    return {
      operator: body.operator,
      permittedCommands: body.permittedCommands as string[],
      assurance: body.assurance,
    };
  });
}

export function interpretMeTenants(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<MeTenantsResponse> {
  return wrap(status, json, networkError, (body) => {
    if (!Array.isArray(body.items)) return null;
    const items: MeTenantItem[] = [];
    for (const row of body.items) {
      const item = asRecord(row);
      if (
        !item ||
        typeof item.tenantId !== 'string' ||
        !item.tenantId.trim() ||
        typeof item.slug !== 'string' ||
        typeof item.name !== 'string' ||
        !isStatus(item.status) ||
        !Array.isArray(item.tenantPermissions) ||
        !item.tenantPermissions.every((p) => typeof p === 'string') ||
        !isRole(item.role)
      ) {
        return null;
      }
      items.push({
        tenantId: item.tenantId.trim(),
        slug: item.slug,
        name: item.name,
        status: item.status,
        tenantPermissions: item.tenantPermissions as string[],
        role: item.role,
      });
    }
    return { items };
  });
}

export function interpretCreateTenant(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<PlatformCreateTenantResponse> {
  return wrap(
    status,
    json,
    networkError,
    (body) => {
      if (
        typeof body.tenantId !== 'string' ||
        !body.tenantId.trim() ||
        body.status !== 'PENDING' ||
        typeof body.version !== 'number' ||
        !Number.isInteger(body.version) ||
        typeof body.ownerInviteId !== 'string' ||
        !body.ownerInviteId.trim()
      ) {
        return null;
      }
      return {
        tenantId: body.tenantId.trim(),
        status: 'PENDING',
        version: body.version,
        ownerInviteId: body.ownerInviteId.trim(),
      };
    },
    [201, 200],
  );
}

export function interpretTenantDetail(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<PlatformTenantDetail> {
  return wrap(status, json, networkError, (body) => {
    const limits = parseLimits(body.limits);
    const flags = parseFlags(body.flags);
    const usage = asRecord(body.usage);
    if (
      typeof body.tenantId !== 'string' ||
      !body.tenantId.trim() ||
      typeof body.slug !== 'string' ||
      typeof body.name !== 'string' ||
      !isStatus(body.status) ||
      typeof body.defaultTimezone !== 'string' ||
      (body.contact !== null && typeof body.contact !== 'string') ||
      typeof body.version !== 'number' ||
      !limits ||
      !flags ||
      !usage ||
      typeof usage.events !== 'number' ||
      typeof usage.staffActive !== 'number' ||
      typeof usage.staffPendingInvites !== 'number' ||
      typeof usage.emailToday !== 'number'
    ) {
      return null;
    }
    return {
      tenantId: body.tenantId.trim(),
      slug: body.slug,
      name: body.name,
      status: body.status,
      defaultTimezone: body.defaultTimezone,
      contact: body.contact,
      version: body.version,
      limits,
      flags,
      usage: {
        events: usage.events,
        staffActive: usage.staffActive,
        staffPendingInvites: usage.staffPendingInvites,
        emailToday: usage.emailToday,
      },
    };
  });
}

export function interpretInviteCreated(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<InviteCreatedResponse> {
  return wrap(
    status,
    json,
    networkError,
    (body) => {
      if (
        typeof body.inviteId !== 'string' ||
        !body.inviteId.trim() ||
        body.state !== 'PENDING' ||
        typeof body.expiresAt !== 'string' ||
        (body.deliveryState !== 'PENDING' && body.deliveryState !== 'FAILED')
      ) {
        return null;
      }
      return {
        inviteId: body.inviteId.trim(),
        state: 'PENDING',
        expiresAt: body.expiresAt,
        deliveryState: body.deliveryState,
      };
    },
    [201, 200],
  );
}

export function interpretAcceptInvite(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<{ tenantId: string; membershipId: string; status: TenantStatus }> {
  return wrap(status, json, networkError, (body) => {
    if (
      typeof body.tenantId !== 'string' ||
      !body.tenantId.trim() ||
      typeof body.membershipId !== 'string' ||
      !body.membershipId.trim() ||
      !isStatus(body.status)
    ) {
      return null;
    }
    return {
      tenantId: body.tenantId.trim(),
      membershipId: body.membershipId.trim(),
      status: body.status,
    };
  });
}

export function interpretSupportGrant(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<SupportGrantResponse> {
  return wrap(
    status,
    json,
    networkError,
    (body) => {
      if (
        typeof body.grantId !== 'string' ||
        !body.grantId.trim() ||
        typeof body.tenantId !== 'string' ||
        typeof body.eventId !== 'string' ||
        !Array.isArray(body.scopes) ||
        !body.scopes.every((s) => s === 'cs.read') ||
        typeof body.expiresAt !== 'string'
      ) {
        return null;
      }
      return {
        grantId: body.grantId.trim(),
        tenantId: body.tenantId.trim(),
        eventId: body.eventId.trim(),
        scopes: body.scopes as SupportScope[],
        expiresAt: body.expiresAt,
      };
    },
    [201, 200],
  );
}

export function interpretAccountDeletion(
  status: number,
  json: unknown,
  networkError: boolean,
): ViewResult<AccountDeletionRequestResponse> {
  return wrap(
    status,
    json,
    networkError,
    (body) => {
      if (
        typeof body.requestId !== 'string' ||
        !body.requestId.trim() ||
        body.state !== 'AWAITING_POLICY' ||
        typeof body.requestedAt !== 'string' ||
        body.policyStatus !== 'UNRESOLVED'
      ) {
        return null;
      }
      return {
        requestId: body.requestId.trim(),
        state: 'AWAITING_POLICY',
        requestedAt: body.requestedAt,
        policyStatus: 'UNRESOLVED',
      };
    },
    [202, 200],
  );
}

export function viewLabel(view: ViewResult<unknown>): string {
  if (view.kind === 'ok') return 'OK';
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}
