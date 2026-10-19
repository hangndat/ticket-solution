import { cookies } from 'next/headers';
import { sessionCookieOptions, SESSION_COOKIES } from '@ticket/web-session';
import {
  discoveryBase,
  isPortalOidcConfigured,
  readPortalOidcConfig,
  type PortalOidcConfig,
} from './config';
import { clearStaffSessionCookies, readStaffSubject } from './cookies';
import { PORTAL_AUTH_COOKIES } from './local-cookies';
import {
  clearStaffRefreshFlightCache,
  singleFlightStaffRefresh,
  staffRefreshFlightKey,
  type RefreshFlightGrant,
  type RefreshFlightResult,
} from './refresh-flight';
import {
  acceptOidcTokenGrant,
  getRemoteJwks,
  TokenVerifyError,
} from './verify-tokens';
import type { JWTVerifyGetKey } from 'jose';

export type TokenGrantResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type RefreshOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'misconfigured' | 'missing_refresh' | 'rejected' | 'network' };

export type ExchangeRefreshFn = (
  config: PortalOidcConfig,
  refreshToken: string,
) => Promise<{ status: number; body: TokenGrantResponse } | null>;

export async function exchangeRefresh(
  config: PortalOidcConfig,
  refreshToken: string,
): Promise<{ status: number; body: TokenGrantResponse } | null> {
  const tokenUrl = `${discoveryBase(config.issuer)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json()) as TokenGrantResponse;
    return { status: response.status, body: json };
  } catch {
    return null;
  }
}

async function applyStaffGrant(
  grant: RefreshFlightGrant,
): Promise<void> {
  const jar = await cookies();
  const maxAge = grant.expiresIn;
  jar.set(
    SESSION_COOKIES.access,
    grant.accessToken,
    sessionCookieOptions(maxAge),
  );
  if (grant.refreshToken) {
    jar.set(
      SESSION_COOKIES.refresh,
      grant.refreshToken,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (grant.idToken) {
    jar.set(
      SESSION_COOKIES.idToken,
      grant.idToken,
      sessionCookieOptions(maxAge),
    );
  }
  jar.set(
    PORTAL_AUTH_COOKIES.subject,
    grant.subject,
    sessionCookieOptions(60 * 60 * 24 * 30),
  );
}

/**
 * Production refresh path used by single-flight workers.
 * Injectable exchange + JWKS for route/HTTP tests with local fixtures.
 */
export async function performStaffRefreshFlight(input: {
  refreshToken: string;
  config: PortalOidcConfig;
  expectedSubject?: string | null;
  exchange?: ExchangeRefreshFn;
  jwks?: JWTVerifyGetKey;
}): Promise<RefreshFlightResult> {
  const exchange = input.exchange ?? exchangeRefresh;
  const result = await exchange(input.config, input.refreshToken);
  if (!result) return { ok: false, reason: 'network' };
  if (
    result.status < 200 ||
    result.status >= 300 ||
    !result.body.access_token
  ) {
    return { ok: false, reason: 'rejected' };
  }

  try {
    const grant = await acceptOidcTokenGrant({
      accessToken: result.body.access_token,
      idToken: result.body.id_token,
      refreshToken: result.body.refresh_token,
      expiresIn: result.body.expires_in,
      issuer: input.config.issuer,
      clientId: input.config.clientId,
      accessAudience: input.config.audience,
      jwks: input.jwks ?? getRemoteJwks(input.config.jwksUrl),
      expectedSubject: input.expectedSubject,
    });
    return { ok: true, grant };
  } catch (error) {
    if (error instanceof TokenVerifyError) {
      return { ok: false, reason: 'rejected' };
    }
    return { ok: false, reason: 'rejected' };
  }
}

/**
 * Rotate staff access (and refresh when IdP returns a new one).
 * Single-flight keyed by hash(refresh+issuer+client). Verify JWTs before
 * setting cookies. On shared failure every waiter clears fail-closed; on
 * success every waiter applies the same grant to its own jar.
 */
export async function refreshStaffAccessToken(): Promise<RefreshOutcome> {
  if (!isPortalOidcConfigured()) {
    clearStaffRefreshFlightCache();
    await clearStaffSessionCookies();
    return { ok: false, reason: 'misconfigured' };
  }
  const config = readPortalOidcConfig()!;
  const jar = await cookies();
  const refresh = jar.get(SESSION_COOKIES.refresh)?.value?.trim() ?? '';
  if (!refresh) {
    clearStaffRefreshFlightCache();
    await clearStaffSessionCookies();
    return { ok: false, reason: 'missing_refresh' };
  }

  const expectedSubject = await readStaffSubject();
  const key = staffRefreshFlightKey(refresh, config.issuer, config.clientId);
  const shared = await singleFlightStaffRefresh(key, () =>
    performStaffRefreshFlight({
      refreshToken: refresh,
      config,
      expectedSubject,
    }),
  );

  if (!shared.ok) {
    clearStaffRefreshFlightCache();
    await clearStaffSessionCookies();
    return shared;
  }

  await applyStaffGrant(shared.grant);
  return { ok: true, accessToken: shared.grant.accessToken };
}
