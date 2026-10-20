/**
 * Post-login navigation target (memory only — no tokens in URL).
 * Cleared on logout via wallet-logout.
 */

export type SignInReturnTarget = {
  /** Expo Router path without query (no secrets in route). */
  pathname: string;
};

let parked: SignInReturnTarget | null = null;

const ALLOWED_EXACT = new Set([
  '/redeem',
  '/redeem-global',
  '/claim',
  '/(tabs)/my-tickets',
  '/(tabs)/(events)',
]);

function isAllowedReturnPath(pathname: string): boolean {
  const path = pathname.trim();
  if (!path.startsWith('/')) return false;
  if (path.includes('?') || path.includes('#')) return false;
  if (ALLOWED_EXACT.has(path)) return true;
  if (/^\/my-tickets\/[0-9a-f-]{36}$/i.test(path)) return true;
  if (/^\/\(tabs\)\/my-tickets\/[0-9a-f-]{36}$/i.test(path)) return true;
  return false;
}

export function peekSignInReturn(): SignInReturnTarget | null {
  return parked;
}

export function parkSignInReturn(target: SignInReturnTarget): boolean {
  if (!isAllowedReturnPath(target.pathname)) {
    parked = null;
    return false;
  }
  parked = { pathname: target.pathname };
  return true;
}

export function consumeSignInReturn(): SignInReturnTarget | null {
  const next = parked;
  parked = null;
  return next;
}

export function clearSignInReturn(): void {
  parked = null;
}

/** Drop parked return when leaving a protected screen without signing in. */
export function clearSignInReturnIfPath(pathname: string): void {
  if (parked?.pathname === pathname) {
    parked = null;
  }
}
