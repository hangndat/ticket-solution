/**
 * Absolute product web URLs for email / outbox deep links (O13).
 * Canonical origin after cutover: https://app.vemoki.com — never marketing apex.
 */

export const DEFAULT_PRODUCT_WEB_ORIGIN = 'https://app.vemoki.com';

/** Marketing hosts that must not be used as invite/ticket deep-link bases. */
const MARKETING_APEX_HOSTS = new Set(['vemoki.com', 'www.vemoki.com']);

function hostOf(absoluteUrl: string): string {
  try {
    return new URL(absoluteUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Strip trailing slashes; rewrite marketing apex → product origin (O13).
 * Custom/staging origins are left unchanged.
 */
export function resolveProductWebBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return DEFAULT_PRODUCT_WEB_ORIGIN;
  }
  const host = hostOf(trimmed);
  if (host && MARKETING_APEX_HOSTS.has(host)) {
    return DEFAULT_PRODUCT_WEB_ORIGIN;
  }
  return trimmed;
}

export function buildInviteAcceptLink(input: {
  publicWebBaseUrl: string;
  token: string;
}): string {
  const base = resolveProductWebBaseUrl(input.publicWebBaseUrl);
  return `${base}/invite?token=${encodeURIComponent(input.token)}`;
}

/**
 * Guest invitation claim URL for InvitationReady mail.
 * Token lives in the URL fragment (#…) so it is not sent as a query Referrer
 * (matches apps/web claim-intent: `#token=&tenantId=&eventId=`).
 */
export function buildGuestInvitationClaimLink(input: {
  publicWebBaseUrl: string;
  token: string;
  tenantId: string;
  eventId: string;
  tenantSlug?: string;
  eventSlug?: string;
}): string {
  const base = resolveProductWebBaseUrl(input.publicWebBaseUrl);
  const hash = new URLSearchParams();
  hash.set('token', input.token);
  hash.set('tenantId', input.tenantId);
  hash.set('eventId', input.eventId);
  if (input.tenantSlug) hash.set('tenantSlug', input.tenantSlug);
  if (input.eventSlug) hash.set('eventSlug', input.eventSlug);
  return `${base}/claim#${hash.toString()}`;
}

/**
 * Canonical owner ticket URL embedded in TicketIssued email `{{ticketLink}}`
 * (see `processClaimedOutbox` → `buildOwnerTicketLink`).
 *
 * Contract path (locked by `test/qr-ticket-link-unit.test.cjs`):
 *   `{resolvedPublicWebBase}/t/{tenantSlug}/tickets/{ticketId}`
 *
 * Base goes through `resolveProductWebBaseUrl` (O13: marketing apex → app.vemoki.com).
 * Do **not** silently change the path segments — emails already sent keep the old URL;
 * path cutover needs coordinator confirm. Matrix:
 * `docs/reviews/D13-BUG-BE-TICKET-LINK-AUDIT.md`.
 */
export function buildOwnerTicketLink(input: {
  publicWebBaseUrl: string;
  tenantSlug: string;
  ticketId: string;
}): string {
  const base = resolveProductWebBaseUrl(input.publicWebBaseUrl);
  // Owner-auth ticket view — no credential/token query params.
  return `${base}/t/${encodeURIComponent(input.tenantSlug)}/tickets/${encodeURIComponent(input.ticketId)}`;
}
