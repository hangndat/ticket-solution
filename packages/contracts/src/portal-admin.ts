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
  deliveryState: 'PENDING' | 'FAILED';
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
