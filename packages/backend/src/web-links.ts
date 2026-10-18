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

export function buildOwnerTicketLink(input: {
  publicWebBaseUrl: string;
  tenantSlug: string;
  ticketId: string;
}): string {
  const base = resolveProductWebBaseUrl(input.publicWebBaseUrl);
  // Owner-auth ticket view — no credential/token query params.
  return `${base}/t/${encodeURIComponent(input.tenantSlug)}/tickets/${encodeURIComponent(input.ticketId)}`;
}
