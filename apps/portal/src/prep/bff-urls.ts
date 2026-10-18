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
