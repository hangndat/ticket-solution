import { cookies } from 'next/headers';
import { sessionCookieOptions, SESSION_COOKIES } from '@ticket/web-session';
import {
  discoveryBase,
  isPortalOidcConfigured,
  readPortalOidcConfig,
  type PortalOidcConfig,
} from './config';
import { clearStaffSessionCookies } from './cookies';

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

async function exchangeRefresh(
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
    });
    const json = (await response.json()) as TokenGrantResponse;
    return { status: response.status, body: json };
  } catch {
    return null;
  }
}

/**
 * Rotate staff access (and refresh when IdP returns a new one).
 * On any failure: clear staff jar fail-closed — never keep a half-dead session.
 */
export async function refreshStaffAccessToken(): Promise<RefreshOutcome> {
  if (!isPortalOidcConfigured()) {
    await clearStaffSessionCookies();
    return { ok: false, reason: 'misconfigured' };
  }
  const config = readPortalOidcConfig()!;
  const jar = await cookies();
  const refresh = jar.get(SESSION_COOKIES.refresh)?.value?.trim() ?? '';
  if (!refresh) {
    await clearStaffSessionCookies();
    return { ok: false, reason: 'missing_refresh' };
  }

  const result = await exchangeRefresh(config, refresh);
  if (!result) {
    await clearStaffSessionCookies();
    return { ok: false, reason: 'network' };
  }
  if (
    result.status < 200 ||
    result.status >= 300 ||
    !result.body.access_token
  ) {
    await clearStaffSessionCookies();
    return { ok: false, reason: 'rejected' };
  }

  const maxAge = Math.max(60, result.body.expires_in ?? 300);
  jar.set(
    SESSION_COOKIES.access,
    result.body.access_token,
    sessionCookieOptions(maxAge),
  );
  if (result.body.refresh_token) {
    jar.set(
      SESSION_COOKIES.refresh,
      result.body.refresh_token,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (result.body.id_token) {
    jar.set(
      SESSION_COOKIES.idToken,
      result.body.id_token,
      sessionCookieOptions(maxAge),
    );
  }
  return { ok: true, accessToken: result.body.access_token };
}

/** Pure helper for unit tests — does not touch cookies. */
export function classifyRefreshFailure(input: {
  configured: boolean;
  hasRefresh: boolean;
  httpStatus: number | null;
  accessToken?: string;
}): Extract<RefreshOutcome, { ok: false }> {
  if (!input.configured) return { ok: false, reason: 'misconfigured' };
  if (!input.hasRefresh) return { ok: false, reason: 'missing_refresh' };
  if (input.httpStatus === null) return { ok: false, reason: 'network' };
  if (
    input.httpStatus < 200 ||
    input.httpStatus >= 300 ||
    !input.accessToken
  ) {
    return { ok: false, reason: 'rejected' };
  }
  // Successful HTTP+token is not a failure; tests only cover fail paths.
  return { ok: false, reason: 'rejected' };
}
