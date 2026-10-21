import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import type { GateSsrTrace } from '../gate/gate-ssr-trace';
import { isOidcConfigured } from '../oidc/config';
import { clearSessionCookies, readAccessToken } from '../oidc/cookies';
import { refreshWebAccessToken } from '../oidc/refresh';
import { bffApiError } from './api-error';

export { bffApiError } from './api-error';
export { isUuid } from './ids';

export function apiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

function passthroughUpstream(
  upstream: Response,
  body: ArrayBuffer,
): Response {
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
  timeoutMs = 20_000,
): Promise<Response> {
  const base = apiBaseUrl();
  const url = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  try {
    const upstream = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
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

function refreshFailureResponse(
  reason: 'misconfigured' | 'missing_refresh' | 'rejected' | 'network',
): Response {
  if (reason === 'network') {
    return bffApiError(
      'IDENTITY_UNAVAILABLE',
      'Identity provider unreachable — try again shortly.',
      503,
      true,
    );
  }
  return bffApiError(
    IDENTITY_ERROR_CODES.UNAUTHENTICATED,
    reason === 'rejected'
      ? 'Session expired — sign in again.'
      : 'Not signed in.',
    401,
  );
}

/**
 * Unauthenticated forward for public published projections only.
 * Never attach Bearer; always no-store.
 */
export async function forwardPublic(
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = apiBaseUrl();
  const url = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  headers.delete('Authorization');

  try {
    const upstream = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
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
 * Read HttpOnly OIDC access cookie and forward to Nest with Bearer.
 * Refreshes on missing access (when refresh cookie present) and retries once on 401.
 * Never exposes the token. IdP outage does not clear cookies.
 */
export type ForwardWithBearerOptions = {
  /** Upstream fetch budget (default 20s). Staff SSR discovery uses a shorter budget. */
  timeoutMs?: number;
  /** GATE_SSR_TRACE=1 only — step names + ms, no paths with secrets. */
  trace?: GateSsrTrace;
};

export async function forwardWithBearer(
  pathAndQuery: string,
  init: RequestInit = {},
  options: ForwardWithBearerOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const trace = options.trace;
  trace?.mark('forward_with_bearer_start');
  if (!isOidcConfigured()) {
    return bffApiError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC chưa cấu hình — thiếu OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_REDIRECT_URI.',
      503,
    );
  }

  let token = await readAccessToken();
  if (!token) {
    trace?.mark('forward_refresh_missing_access');
    const refreshed = await refreshWebAccessToken(trace);
    if (!refreshed.ok) {
      trace?.mark(`forward_refresh_fail_${refreshed.reason}`);
      return refreshFailureResponse(refreshed.reason);
    }
    token = refreshed.accessToken;
  }

  trace?.mark('forward_upstream_fetch');
  let response = await fetchWithBearer(pathAndQuery, token, init, timeoutMs);
  trace?.mark(`forward_upstream_status_${response.status}`);
  if (response.status !== 401) return response;

  trace?.mark('forward_refresh_401');
  const refreshed = await refreshWebAccessToken(trace);
  if (!refreshed.ok) {
    trace?.mark(`forward_refresh_401_fail_${refreshed.reason}`);
    if (refreshed.reason === 'network') {
      return refreshFailureResponse('network');
    }
    await clearSessionCookies();
    return refreshFailureResponse(refreshed.reason);
  }
  trace?.mark('forward_upstream_fetch_retry');
  response = await fetchWithBearer(
    pathAndQuery,
    refreshed.accessToken,
    init,
    timeoutMs,
  );
  trace?.mark(`forward_upstream_retry_status_${response.status}`);
  return response;
}
