/**
 * Exact platform DTO mirror from BE hangndat/d4-backend-platform-m01 @ 266782c
 * (packages/contracts). Do not invent fields; regenerate when BE SHA advances.
 */

export const PLATFORM_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  PLATFORM_OPERATOR_REQUIRED: 'PLATFORM_OPERATOR_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  MEMBERSHIP_REVOKED: 'MEMBERSHIP_REVOKED',
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  STALE_VERSION: 'STALE_VERSION',
  LAST_OWNER_REQUIRED: 'LAST_OWNER_REQUIRED',
  LIMIT_BELOW_USAGE: 'LIMIT_BELOW_USAGE',
  TENANT_LIMIT_REACHED: 'TENANT_LIMIT_REACHED',
  INVITE_ALREADY_USED: 'INVITE_ALREADY_USED',
  INVITE_INVALID_OR_EXPIRED: 'INVITE_INVALID_OR_EXPIRED',
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_PENDING: 'TENANT_PENDING',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  PLATFORM_MISCONFIGURED: 'PLATFORM_MISCONFIGURED',
  BOOTSTRAP_ALREADY_DONE: 'BOOTSTRAP_ALREADY_DONE',
} as const;

export type PlatformErrorCode =
  (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];

export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type MembershipRole =
  | 'Owner'
  | 'Manager'
  | 'CS'
  | 'Supervisor'
  | 'Scanner';

export type SupportScope = 'cs.read';

export type AccountDeletionState =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'AWAITING_POLICY'
  | 'COMPLETED'
  | 'REJECTED';

export interface TenantLimitsDto {
  maxEvents: number | null;
  maxStaff: number | null;
  emailPerDay: number | null;
  importRowsPerJob: number | null;
}

export interface TenantFlagsDto {
  importsEnabled: boolean;
  exportsEnabled: boolean;
}

export interface MeTenantItem {
  tenantId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  tenantPermissions: string[];
  role: MembershipRole;
}

export interface MeTenantsResponse {
  items: MeTenantItem[];
}

export interface MeEventItem {
  eventId: string;
  name: string;
  permissions: string[];
}

export interface MeEventsResponse {
  items: MeEventItem[];
}

export interface PlatformMeResponse {
  operator: boolean;
  permittedCommands: string[];
  assurance: 'mfa' | 'missing';
}

export interface PlatformCreateTenantBody {
  slug: string;
  name: string;
  defaultTimezone: string;
  contact?: string | null;
  ownerEmail: string;
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
}

export interface PlatformCreateTenantResponse {
  tenantId: string;
  status: 'PENDING';
  version: number;
  ownerInviteId: string;
}

export interface PlatformTenantDetail {
  tenantId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  defaultTimezone: string;
  contact: string | null;
  version: number;
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
  usage: {
    events: number;
    staffActive: number;
    staffPendingInvites: number;
    emailToday: number;
  };
}

export interface PlatformTenantStatusBody {
  status: 'ACTIVE' | 'SUSPENDED';
  reason: string;
  expectedVersion: number;
}

export interface PlatformTenantLimitsBody {
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
  reason: string;
  expectedVersion: number;
}

export interface TenantProfilePatchBody {
  name?: string;
  contact?: string | null;
  defaultTimezone?: string;
  logoAssetId?: string | null;
  expectedVersion: number;
}

export interface CreateInviteBody {
  email: string;
  role: MembershipRole;
  eventAssignments?: Array<{ eventId: string; role: MembershipRole }>;
}

export interface InviteCreatedResponse {
  inviteId: string;
  state: 'PENDING';
  expiresAt: string;
  deliveryState: 'PENDING' | 'FAILED';
}

export interface AcceptInviteBody {
  token: string;
}

export interface AcceptInviteResponse {
  tenantId: string;
  membershipId: string;
  status: TenantStatus;
}

export interface CreateSupportGrantBody {
  tenantId: string;
  eventId: string;
  scopes: SupportScope[];
  reason: string;
  expiresAt: string;
}

export interface SupportGrantResponse {
  grantId: string;
  tenantId: string;
  eventId: string;
  scopes: SupportScope[];
  expiresAt: string;
}

export interface AccountDeletionRequestBody {
  confirmation: true;
}

export interface AccountDeletionRequestResponse {
  requestId: string;
  state: 'AWAITING_POLICY';
  requestedAt: string;
  policyStatus: 'UNRESOLVED';
}

/** Upstream paths from frozen §6 plan (prefix /v1). */
export const PLATFORM_PATHS = {
  platformMe: '/v1/platform/me',
  platformTenants: '/v1/platform/tenants',
  platformTenant: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}`,
  platformTenantStatus: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/status`,
  platformTenantLimits: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/limits`,
  platformTenantHealth: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/health`,
  supportGrants: '/v1/platform/support-grants',
  supportGrantRevoke: (grantId: string) =>
    `/v1/platform/support-grants/${encodeURIComponent(grantId)}/revoke`,
  supportGrantTickets: (grantId: string) =>
    `/v1/platform/support-grants/${encodeURIComponent(grantId)}/tickets`,
  meTenants: '/v1/me/tenants',
  meEvents: (tenantId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/me/events`,
  tenantProfile: (tenantId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}`,
  members: (tenantId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/members`,
  memberRole: (tenantId: string, membershipId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(membershipId)}/role`,
  memberRevoke: (tenantId: string, membershipId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(membershipId)}/revoke`,
  memberEventAssignment: (
    tenantId: string,
    membershipId: string,
    eventId: string,
  ) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(membershipId)}/event-assignments/${encodeURIComponent(eventId)}`,
  invites: (tenantId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/invites`,
  inviteRevoke: (tenantId: string, inviteId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
  inviteResend: (tenantId: string, inviteId: string) =>
    `/v1/tenants/${encodeURIComponent(tenantId)}/invites/${encodeURIComponent(inviteId)}/resend`,
  acceptInvite: '/v1/me/membership-invites/accept',
  accountDeletion: '/v1/me/account-deletion-requests',
  accountDeletionCurrent: '/v1/me/account-deletion-requests/current',
} as const;
