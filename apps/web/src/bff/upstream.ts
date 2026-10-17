import { IDENTITY_ERROR_CODES, type ApiError } from '@ticket/contracts';
import { isOidcConfigured } from '../oidc/config';
import { readAccessToken } from '../oidc/cookies';

export { isUuid } from './ids';

export function apiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

export function bffApiError(
  code: string,
  message: string,
  status: number,
  retryable = false,
): Response {
  const body: ApiError = {
    code,
    message,
    requestId: crypto.randomUUID(),
    retryable,
  };
  return Response.json(body, { status });
}

/**
 * Read HttpOnly OIDC access cookie and forward to Nest with Bearer.
 * Returns a Response (error or upstream passthrough). Never exposes the token.
 */
export async function forwardWithBearer(
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isOidcConfigured()) {
    return bffApiError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC chưa cấu hình — thiếu OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_REDIRECT_URI.',
      503,
    );
  }

  const token = await readAccessToken();
  if (!token) {
    return bffApiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Not signed in.',
      401,
    );
  }

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
    });
    const contentType =
      upstream.headers.get('Content-Type') ?? 'application/json';
    const outHeaders = new Headers({ 'Content-Type': contentType });
    const cacheControl = upstream.headers.get('Cache-Control');
    if (cacheControl) outHeaders.set('Cache-Control', cacheControl);
    else outHeaders.set('Cache-Control', 'private, no-store');
    const disposition = upstream.headers.get('Content-Disposition');
    if (disposition) outHeaders.set('Content-Disposition', disposition);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch {
    return bffApiError(
      'UPSTREAM_UNAVAILABLE',
      `Cannot reach API ${init.method ?? 'GET'} ${url}.`,
      502,
      true,
    );
  }
}
