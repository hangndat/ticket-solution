import { decodeJwt } from 'jose';

/** Skew before exp — avoid SSR discovery 401 → refresh → second upstream fetch (E01 ~12s). */
const EXPIRY_SKEW_SECONDS = 30;

/**
 * Cheap exp check for SSR route guards only — not a security boundary.
 * Full verify happens on refresh grant and API authz.
 */
export function isAccessTokenStaleForSsr(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    const exp =
      typeof payload.exp === 'number'
        ? payload.exp
        : typeof payload.exp === 'string'
          ? Number(payload.exp)
          : NaN;
    if (!Number.isFinite(exp)) return true;
    return exp <= Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS;
  } catch {
    return true;
  }
}
