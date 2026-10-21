/**
 * Safe same-origin post-login return path for guest claim / invite / owner ticket.
 * Never open redirects; allowlist + owner-ticket pattern only.
 */

import { isOwnerTicketPath } from '../owner-ticket/parse';

export const POST_LOGIN_COOKIE = 'vemoki_post_login_path';

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
