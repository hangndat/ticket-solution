/** O16 / ADR-20 additive admin contracts. DTOs contain no raw invite secrets. */
import type { MembershipRole } from './index';
import type { CursorPage } from './common';

export interface PortalMemberAssignment {
  eventId: string;
  permissions: string[];
  activatedAt: string | null;
  revokedAt: string | null;
}
export interface PortalMemberSummary {
  membershipId: string;
  userId: string;
  emailMasked: string | null;
  role: MembershipRole;
  activatedAt: string | null;
  revokedAt: string | null;
  eventAssignments: PortalMemberAssignment[];
}
export type PortalInviteState = 'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED';
export interface PortalInviteSummary {
  inviteId: string;
  emailMasked: string;
  role: MembershipRole;
  state: PortalInviteState;
  expiresAt: string;
  /** ACCEPTED = processing completed; never proof of inbox delivery. */
  deliveryState: 'PENDING' | 'ACCEPTED' | 'FAILED' | 'UNKNOWN';
}
export type PortalMembersPage = CursorPage<PortalMemberSummary>;
export type PortalInvitesPage = CursorPage<PortalInviteSummary>;
/** Server uses the role allowlist; callers cannot supply permission arrays. */
export interface PortalMemberRoleBody {
  role: MembershipRole;
  reason: string;
}
export interface PortalAssignmentBody {
  role: MembershipRole;
  reason: string;
}
export interface PortalReasonBody {
  reason: string;
}
export interface PortalMembershipMutationResponse {
  membershipId: string;
}
export interface PortalInviteRevokeResponse {
  inviteId: string;
  state: 'REVOKED';
}

const tenantBase = (tenantId: string) =>
  `/v1/tenants/${encodeURIComponent(tenantId)}`;
const memberBase = (tenantId: string, membershipId: string) =>
  `${tenantBase(tenantId)}/members/${encodeURIComponent(membershipId)}`;

export const PORTAL_MEMBER_ENDPOINTS = {
  members: (tenantId: string) => `${tenantBase(tenantId)}/members`,
  invites: (tenantId: string) => `${tenantBase(tenantId)}/invites`,
  role: (tenantId: string, membershipId: string) =>
    `${memberBase(tenantId, membershipId)}/role`,
  assignment: (tenantId: string, membershipId: string, eventId: string) =>
    `${memberBase(tenantId, membershipId)}/event-assignments/${encodeURIComponent(eventId)}`,
  revokeMember: (tenantId: string, membershipId: string) =>
    `${memberBase(tenantId, membershipId)}/revoke`,
  revokeInvite: (tenantId: string, inviteId: string) =>
    `${tenantBase(tenantId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
  resendInvite: (tenantId: string, inviteId: string) =>
    `${tenantBase(tenantId)}/invites/${encodeURIComponent(inviteId)}/resend`,
} as const;

/** #418: event-scoped catalog reads require event.config and assignment. */
export interface PortalTicketTypeSummary {
  ticketTypeId: string;
  label: string;
  entitlementSnapshot: Record<string, unknown>;
}
export interface PortalSourceSummary {
  sourceId: string;
  name: string;
  approvalMode: 'AUTO' | 'MANUAL';
  /** A source may map to several types; do not silently take the first. */
  ticketTypeIds: string[];
}
export type PortalTicketTypesPage = CursorPage<PortalTicketTypeSummary>;
export type PortalSourcesPage = CursorPage<PortalSourceSummary>;
export interface PortalCursorQuery {
  cursor?: string;
  /** 1–100, default 20; invalid cursors fail with INVALID_CURSOR. */
  limit?: number;
}
const eventBase = (tenantId: string, eventId: string) =>
  `${tenantBase(tenantId)}/events/${encodeURIComponent(eventId)}`;
export const PORTAL_CATALOG_ENDPOINTS = {
  ticketTypes: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/ticket-types`,
  sources: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/sources`,
} as const;

/** #427: additive filters; omitted values retain legacy list behavior. */
export interface PortalPendingQuery extends PortalCursorQuery {
  status?: 'PENDING_REVIEW';
  sourceId?: string;
  ticketTypeId?: string;
  /** Exact opaque request ID only. Never fuzzy-search attendee email/phone. */
  q?: string;
}
export interface PortalNotificationQuery extends PortalCursorQuery {
  state?: import('./notifications').NotificationProviderStatus;
  channel?: import('./notifications').NotificationChannel;
}
export interface PortalExportQuery extends PortalCursorQuery {
  status?: import('./index').ExportJob['status'];
}
/** List projection never contains object keys or presigned download URLs. */
export interface PortalExportSummary extends PortalExportJob {
  createdAt: string;
}
type PortalExportJob = import('./index').ExportJob;
export type PortalExportsPage = CursorPage<PortalExportSummary>;
export const PORTAL_FILTER_ENDPOINTS = {
  pending: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/redemptions`,
  notifications: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/notifications`,
  exports: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/exports`,
} as const;

/** #431: allowlisted audit projection. No reason, diff, payload or raw PII. */
export interface PortalAuditEntry {
  auditId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  operationId: string | null;
  createdAt: string;
}
export interface PortalAuditQuery extends PortalCursorQuery {
  from?: string;
  to?: string;
  action?: string;
}
export type PortalAuditPage = CursorPage<PortalAuditEntry>;
export type PortalCodeState = 'AVAILABLE' | 'HELD' | 'CONSUMED';
/** Stored inventory has only HMACs; do not fabricate recoverable suffixes. */
export interface PortalCodeSummary {
  codeId: string;
  state: PortalCodeState;
  sourceId: string;
  ticketTypeId: string;
}
export interface PortalCodesQuery extends PortalCursorQuery {
  state?: PortalCodeState;
  sourceId?: string;
  ticketTypeId?: string;
  /** Exact code lookup, hashed server-side; never echoed or logged. */
  q?: string;
}
export type PortalCodesPage = CursorPage<PortalCodeSummary>;
export interface PortalPlatformAuditEntry extends Omit<
  PortalAuditEntry,
  'operationId'
> {
  tenantId: string | null;
}
export interface PortalPlatformAuditQuery extends PortalAuditQuery {
  tenantId?: string;
}
export type PortalPlatformAuditPage = CursorPage<PortalPlatformAuditEntry>;
export interface PortalPlatformTenantSummary {
  tenantId: string;
  slug: string;
  name: string;
  status: import('./index').TenantStatus;
  version: number;
  createdAt: string;
}
export type PortalPlatformTenantsPage = CursorPage<PortalPlatformTenantSummary>;
/** Operational counters observed now; not delivery confirmation or an SLA. */
export interface PortalPlatformTenantHealth {
  tenantId: string;
  observedAt: string;
  notifications: { pending: number; failed: number; dead: number };
  outbox: { pending: number; failed: number };
  usage: import('./index').PlatformTenantDetail['usage'];
}
export const PORTAL_AUDIT_ENDPOINTS = {
  eventAudit: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/audit`,
  codes: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/codes`,
  platformAudit: '/v1/platform/audit',
  platformTenants: '/v1/platform/tenants',
  platformTenantHealth: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/health`,
} as const;
