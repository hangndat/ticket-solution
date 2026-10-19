import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import { isPortalOidcConfigured } from '../oidc/config';
import {
  clearPlatformSessionCookies,
  clearStaffSessionCookies,
  readPlatformAccessToken,
  readStaffAccessToken,
} from '../oidc/cookies';
import {
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../oidc/platform-config';
import { refreshStaffAccessToken } from '../oidc/refresh';
import { getRemoteJwks, verifyAccessToken } from '../oidc/verify-tokens';
import { bffApiError } from './api-error';

export { bffApiError } from './api-error';

export function apiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.API_BASE_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
}

function passthroughUpstream(upstream: Response, body: ArrayBuffer): Response {
  const contentType =
    upstream.headers.get('Content-Type') ?? 'application/json';
  const outHeaders = new Headers({ 'Content-Type': contentType });
  const cacheControl = upstream.headers.get('Cache-Control');
  if (cacheControl) outHeaders.set('Cache-Control', cacheControl);
  else outHeaders.set('Cache-Control', 'private, no-store');
  const disposition = upstream.headers.get('Content-Disposition');
  if (disposition) outHeaders.set('Content-Disposition', disposition);
  return new Response(body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

async function fetchWithBearer(
  pathAndQuery: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = apiBaseUrl();
  const url = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  try {
    const upstream = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.arrayBuffer();
    return passthroughUpstream(upstream, body);
  } catch {
    return bffApiError(
      'UPSTREAM_UNAVAILABLE',
      `Cannot reach API ${init.method ?? 'GET'} ${url}.`,
      502,
      true,
    );
  }
}

/**
 * Staff Bearer forward with refresh_token rotation on 401.
 * Refresh failure clears session fail-closed.
 */
export async function forwardStaffBearer(
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isPortalOidcConfigured()) {
    return bffApiError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC chưa cấu hình — thiếu OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_REDIRECT_URI.',
      503,
    );
  }

  let token = await readStaffAccessToken();
  if (!token) {
    const refreshed = await refreshStaffAccessToken();
    if (!refreshed.ok) {
      return bffApiError(
        IDENTITY_ERROR_CODES.UNAUTHENTICATED,
        'Not signed in.',
        401,
      );
    }
    token = refreshed.accessToken;
  }

  let response = await fetchWithBearer(pathAndQuery, token, init);
  if (response.status !== 401) return response;

  const refreshed = await refreshStaffAccessToken();
  if (!refreshed.ok) {
    await clearStaffSessionCookies();
    return bffApiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Session expired — sign in again.',
      401,
    );
  }
  response = await fetchWithBearer(pathAndQuery, refreshed.accessToken, init);
  return response;
}

/** Platform Operator Bearer — never reuses staff access cookie. */
export async function forwardPlatformBearer(
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isPlatformOidcConfigured()) {
    return bffApiError(
      'PLATFORM_MISCONFIGURED',
      'Platform OIDC chưa cấu hình (PLATFORM_OIDC_CLIENT_ID/SECRET/REDIRECT_URI/AUDIENCE/REQUIRED_ACR/JWKS).',
      503,
    );
  }
  const config = readPlatformOidcConfig()!;
  const token = await readPlatformAccessToken();
  if (!token) {
    return bffApiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Platform session missing — sign in via /api/auth/platform/login.',
      401,
    );
  }
  try {
    await verifyAccessToken(token, {
      issuer: config.issuer,
      audience: config.audience,
      clientId: config.clientId,
      jwks: getRemoteJwks(config.jwksUrl),
      platform: {
        requiredAcr: config.requiredAcr,
        maxAuthAgeSeconds: config.maxAuthAgeSeconds,
      },
    });
  } catch {
    await clearPlatformSessionCookies();
    return bffApiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Platform token invalid — sign in again.',
      401,
    );
  }
  return fetchWithBearer(pathAndQuery, token, init);
}

export const PORTAL_API_PATHS = {
  meTenants: '/v1/me/tenants',
  meEvents: '/v1/me/events',
  platformMe: '/v1/platform/me',
  platformTenants: '/v1/platform/tenants',
  platformAudit: '/v1/platform/audit',
} as const;
