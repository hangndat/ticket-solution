/**
 * Safe same-origin post-login return path for guest claim / invite / owner ticket.
 * Never open redirects; allowlist + owner-ticket pattern only.
 */

import { isUuid } from '../bff/ids';
import { isOwnerTicketPath } from '../owner-ticket/parse';

export const POST_LOGIN_COOKIE = 'vemoki_post_login_path';

const SLUG_PARAM_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Preserve tenant-bound redeem scope on OIDC return (UAT / deep links). */
function sanitizeRedeemReturnPath(raw: string): string | null {
  if (!raw.startsWith('/redeem')) return null;
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return '/redeem';
  const query = raw.slice(qIndex + 1).split('#')[0] ?? '';
  const params = new URLSearchParams(query);
  const next = new URLSearchParams();
  const tenantSlug = params.get('tenantSlug')?.trim() ?? '';
  const eventSlug = params.get('eventSlug')?.trim() ?? '';
  const tenantId = params.get('tenantId')?.trim() ?? '';
  const eventId = params.get('eventId')?.trim() ?? '';
  if (tenantSlug && SLUG_PARAM_RE.test(tenantSlug)) {
    next.set('tenantSlug', tenantSlug);
  }
  if (eventSlug && SLUG_PARAM_RE.test(eventSlug)) {
    next.set('eventSlug', eventSlug);
  }
  if (tenantId && isUuid(tenantId)) {
    next.set('tenantId', tenantId);
  }
  if (eventId && isUuid(eventId)) {
    next.set('eventId', eventId);
  }
  const built = next.toString();
  return built ? `/redeem?${built}` : '/redeem';
}

const ALLOWED = new Set([
  '/',
  '/claim',
  '/invite',
  '/redeem',
  '/wallet',
  '/admin',
  '/auth',
  '/account',
  '/gate',
]);

/** Validate path-only return (no scheme/host/query injection). */
export function sanitizePostLoginPath(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('://') || trimmed.includes('\\')) return null;
  const pathOnly = trimmed.split('?')[0]?.split('#')[0] ?? '';
  if (pathOnly === '/redeem') {
    return sanitizeRedeemReturnPath(trimmed);
  }
  if (ALLOWED.has(pathOnly)) {
    // Preserve allowlisted path; drop arbitrary query for safety.
    return pathOnly;
  }
  // Email deeplink: /t/{slug}/tickets/{uuid} (buildOwnerTicketLink).
  if (isOwnerTicketPath(pathOnly)) {
    return pathOnly;
  }
  return null;
}

export function postLoginCookieOptions(maxAgeSec = 600): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  };
}
