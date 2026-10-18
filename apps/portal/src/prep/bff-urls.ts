/** Client BFF paths — tenant/event come from route context (no hand-typed UUID). */

export function bffEvents(tenantId: string): string {
  return `/api/bff/tenants/${encodeURIComponent(tenantId)}/events`;
}

export function bffEvent(tenantId: string, eventId: string): string {
  return `${bffEvents(tenantId)}/${encodeURIComponent(eventId)}`;
}

export function bffEventAction(
  tenantId: string,
  eventId: string,
  action: string,
): string {
  return `${bffEvent(tenantId, eventId)}/${action}`;
}

export function bffMembers(tenantId: string): string {
  return `/api/bff/tenants/${encodeURIComponent(tenantId)}/members`;
}

export function bffInvites(tenantId: string): string {
  return `/api/bff/tenants/${encodeURIComponent(tenantId)}/invites`;
}

export function bffBranding(tenantId: string): string {
  return `/api/bff/tenants/${encodeURIComponent(tenantId)}/branding`;
}

export function bffRevokeMember(tenantId: string, membershipId: string): string {
  return `${bffMembers(tenantId)}/${encodeURIComponent(membershipId)}/revoke`;
}

export function bffRevokeInvite(tenantId: string, inviteId: string): string {
  return `${bffInvites(tenantId)}/${encodeURIComponent(inviteId)}/revoke`;
}

/** Ops BFF (import / pending / CS / notify / export) — route-scoped UUIDs. */
export function bffImports(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'imports');
}

export function bffImportsUpload(tenantId: string, eventId: string): string {
  return `${bffImports(tenantId, eventId)}/upload`;
}

export function bffImportJob(
  tenantId: string,
  eventId: string,
  importId: string,
): string {
  return `${bffImports(tenantId, eventId)}/${encodeURIComponent(importId)}`;
}

export function bffInvitations(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'invitations');
}

export function bffInvitationDispatchPreview(
  tenantId: string,
  eventId: string,
): string {
  return `${bffInvitations(tenantId, eventId)}/dispatch-preview`;
}

export function bffRedemptions(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'redemptions');
}

export function bffTickets(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'tickets');
}

export function bffNotifications(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'notifications');
}

export function bffExports(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'exports');
}

/** H-A1 / H-C1 event-scoped reads. */
export function bffAudit(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'audit');
}

export function bffCodes(tenantId: string, eventId: string): string {
  return bffEventAction(tenantId, eventId, 'codes');
}

/** Platform Operator BFF — never call with staff cookie. */
export function bffPlatformTenants(): string {
  return '/api/bff/platform/tenants';
}

export function bffPlatformAudit(): string {
  return '/api/bff/platform/audit';
}

export function bffPlatformTenantHealth(tenantId: string): string {
  return `/api/bff/platform/tenants/${encodeURIComponent(tenantId)}/health`;
}

export function bffPlatformSupportGrantRevoke(grantId: string): string {
  return `/api/bff/platform/support-grants/${encodeURIComponent(grantId)}/revoke`;
}
