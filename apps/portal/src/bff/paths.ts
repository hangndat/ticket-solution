/** Nest upstream paths for portal prep (ADR-20 / O16). */

const tenantBase = (tenantId: string) =>
  `/v1/tenants/${encodeURIComponent(tenantId)}`;

const eventBase = (tenantId: string, eventId: string) =>
  `${tenantBase(tenantId)}/events/${encodeURIComponent(eventId)}`;

export const PORTAL_UPSTREAM = {
  events: (tenantId: string) => `${tenantBase(tenantId)}/events`,
  event: (tenantId: string, eventId: string) => eventBase(tenantId, eventId),
  clone: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/clone`,
  archive: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/archive`,
  ticketTypes: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/ticket-types`,
  sources: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/sources`,
  quota: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/quota`,
  publish: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/publish`,
  configVersions: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/config-versions`,
  configPreview: (tenantId: string, eventId: string, version: number) =>
    `${eventBase(tenantId, eventId)}/config-versions/${version}/preview`,
  configRollback: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/config/rollback`,
  report: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/report`,
  members: (tenantId: string) => `${tenantBase(tenantId)}/members`,
  revokeMember: (tenantId: string, membershipId: string) =>
    `${tenantBase(tenantId)}/members/${encodeURIComponent(membershipId)}/revoke`,
  invites: (tenantId: string) => `${tenantBase(tenantId)}/invites`,
  revokeInvite: (tenantId: string, inviteId: string) =>
    `${tenantBase(tenantId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
  branding: (tenantId: string) => `${tenantBase(tenantId)}/branding`,
} as const;
