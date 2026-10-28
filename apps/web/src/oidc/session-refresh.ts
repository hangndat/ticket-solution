import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookieOptions } from '@ticket/web-session';
import { clearEstablishedSessionCookies, readRefreshToken } from './cookies';
import { sanitizePostLoginPath } from './post-login';

/** One SSR discovery 401 → refresh route; second 401 → /auth (no loop). */
export const SSR_REFRESH_ATTEMPT_COOKIE = 'vemoki_ssr_refresh_attempt';

const SSR_REFRESH_ATTEMPT_MAX_AGE_SEC = 120;

export function sessionRefreshRoutePath(nextPath: string): string {
  const safe = sanitizePostLoginPath(nextPath) ?? '/';
  return `/api/auth/refresh?next=${encodeURIComponent(safe)}`;
}

/** Terminal fail-closed: `/auth` stub maps `error` → `/?notice=auth_failed` (no SSO loop). */
export function ssrTerminalAuthRejectPath(nextPath: string): string {
  const safe = sanitizePostLoginPath(nextPath) ?? '/';
  return `/auth?error=session_rejected&next=${encodeURIComponent(safe)}`;
}

export async function markSsrRefreshAttempt(): Promise<void> {
  const jar = await cookies();
  jar.set(
    SSR_REFRESH_ATTEMPT_COOKIE,
    '1',
    sessionCookieOptions(SSR_REFRESH_ATTEMPT_MAX_AGE_SEC),
  );
}

export async function clearSsrRefreshAttempt(): Promise<void> {
  const jar = await cookies();
  jar.delete(SSR_REFRESH_ATTEMPT_COOKIE);
}

export async function hasSsrRefreshAttempt(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(SSR_REFRESH_ATTEMPT_COOKIE)?.value?.trim());
}

/**
 * SSR guards: never call refreshWebAccessToken (Next forbids Set-Cookie in RSC).
 * At most one GET /api/auth/refresh per attempt window, then terminal reject (no loop).
 */
async function redirectToSsrRefreshRouteOnce(nextPath: string): Promise<void> {
  const safeNext = sanitizePostLoginPath(nextPath) ?? '/';
  if (await hasSsrRefreshAttempt()) {
    await clearEstablishedSessionCookies();
    await clearSsrRefreshAttempt();
    redirect(ssrTerminalAuthRejectPath(safeNext));
  }
  const refresh = await readRefreshToken();
  if (!refresh) {
    redirect(`/auth?next=${encodeURIComponent(safeNext)}`);
  }
  redirect(sessionRefreshRoutePath(safeNext));
}

/** Missing/stale/wrong-audience access cookie. */
export async function redirectForSsrSessionRenewal(
  nextPath: string,
): Promise<void> {
  await redirectToSsrRefreshRouteOnce(nextPath);
}

/** Upstream returned 401 during SSR discovery. */
export async function redirectForSsrDiscovery401(
  nextPath: string,
): Promise<void> {
  await redirectToSsrRefreshRouteOnce(nextPath);
}
