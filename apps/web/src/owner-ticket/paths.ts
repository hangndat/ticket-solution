import { isTenantSlug } from '../branding';
import { isUuid } from '../bff/ids';

/**
 * Email / deep-link contract (buildOwnerTicketLink):
 * `/t/{tenantSlug}/tickets/{ticketId}` — owner-auth, no credential query params.
 */
export function ownerTicketPath(tenantSlug: string, ticketId: string): string {
  return `/t/${encodeURIComponent(tenantSlug.trim())}/tickets/${encodeURIComponent(ticketId.trim())}`;
}

export function isOwnerTicketParams(
  tenantSlug: string,
  ticketId: string,
): boolean {
  const slug = tenantSlug.trim().toLowerCase();
  const id = ticketId.trim();
  return isTenantSlug(slug) && isUuid(id);
}

export function ownerTicketAuthHref(
  tenantSlug: string,
  ticketId: string,
): string {
  const next = ownerTicketPath(tenantSlug, ticketId);
  return `/auth?next=${encodeURIComponent(next)}`;
}
