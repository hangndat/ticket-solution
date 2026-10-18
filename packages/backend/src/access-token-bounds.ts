import type * as jose from 'jose';

/** R1: max accepted access-token lifetime / age = 24h; clock skew +5m. */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;
export const ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS = 5 * 60;

export type AccessTokenBoundFailure =
  | 'IAT_MISSING'
  | 'EXP_MISSING'
  | 'LIFETIME_EXCEEDED'
  | 'AGE_EXCEEDED';

/**
 * Enforce exp−iat ≤ 24h and age from iat ≤ 24h+5m (in addition to jose maxTokenAge).
 */
export function assertAccessTokenBounds(
  payload: jose.JWTPayload,
  nowSeconds = Math.floor(Date.now() / 1000),
): AccessTokenBoundFailure | null {
  const iat =
    typeof payload.iat === 'number'
      ? payload.iat
      : typeof payload.iat === 'string'
        ? Number(payload.iat)
        : NaN;
  if (!Number.isFinite(iat)) return 'IAT_MISSING';

  const exp =
    typeof payload.exp === 'number'
      ? payload.exp
      : typeof payload.exp === 'string'
        ? Number(payload.exp)
        : NaN;
  if (!Number.isFinite(exp)) return 'EXP_MISSING';

  if (exp - iat > ACCESS_TOKEN_MAX_AGE_SECONDS) {
    return 'LIFETIME_EXCEEDED';
  }
  if (
    nowSeconds - iat >
    ACCESS_TOKEN_MAX_AGE_SECONDS + ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS
  ) {
    return 'AGE_EXCEEDED';
  }
  return null;
}

export const JOSE_ACCESS_TOKEN_VERIFY_EXTRAS = {
  maxTokenAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  clockTolerance: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
} as const;
