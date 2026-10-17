/**
 * Safe same-origin post-login return path for guest claim / invite flows.
 * Never open redirects; allowlist only.
 */

export const POST_LOGIN_COOKIE = 'vemoki_post_login_path';

const ALLOWED = new Set([
  '/claim',
  '/invite',
  '/redeem',
  '/admin',
  '/auth',
  '/account',
]);

/** Validate path-only return (no scheme/host/query injection). */
export function sanitizePostLoginPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('://') || trimmed.includes('\\')) return null;
  const pathOnly = trimmed.split('?')[0]?.split('#')[0] ?? '';
  if (!ALLOWED.has(pathOnly)) return null;
  // Preserve allowlisted path; drop arbitrary query for safety.
  return pathOnly;
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
