import { sanitizePostLoginPath } from './post-login';

/**
 * Guest login CTA → BFF PKCE start (AC-S2).
 * Never points at product `/auth` UI.
 */
export function loginHref(returnPath?: string | null): string {
  const sanitized = sanitizePostLoginPath(returnPath);
  if (!sanitized || sanitized === '/') {
    return '/api/auth/login?return=/';
  }
  return `/api/auth/login?return=${encodeURIComponent(sanitized)}`;
}
