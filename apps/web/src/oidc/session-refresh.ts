import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookieOptions } from '@ticket/web-session';
import { readRefreshToken } from './cookies';
import { sanitizePostLoginPath } from './post-login';

/** One SSR discovery 401 → refresh route; second 401 → /auth (no loop). */
export const SSR_REFRESH_ATTEMPT_COOKIE = 'vemoki_ssr_refresh_attempt';

const SSR_REFRESH_ATTEMPT_MAX_AGE_SEC = 120;

export function sessionRefreshRoutePath(nextPath: string): string {
  const safe = sanitizePostLoginPath(nextPath) ?? '/';
  return `/api/auth/refresh?next=${encodeURIComponent(safe)}`;
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
 * At most one GET /api/auth/refresh per attempt window, then /auth (no loop).
 */
async function redirectToSsrRefreshRouteOnce(nextPath: string): Promise<void> {
  const refresh = await readRefreshToken();
  if (!refresh || (await hasSsrRefreshAttempt())) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }
  redirect(sessionRefreshRoutePath(nextPath));
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
