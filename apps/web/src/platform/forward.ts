import { cookies } from 'next/headers';
import { PLATFORM_ERROR_CODES } from './contracts';
import {
  PLATFORM_ACCESS_COOKIE,
  isPlatformOidcConfigured,
} from './oidc';
import { apiBaseUrl, bffApiError } from '../bff/upstream';

/**
 * Forward platform BFF with platform-session cookie (not attendee cookie).
 * Fail closed when platform OIDC env missing — no fake MFA / operator claim.
 */
export async function forwardPlatformBearer(
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isPlatformOidcConfigured()) {
    return bffApiError(
      PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
      'Platform OIDC chưa cấu hình (PLATFORM_OIDC_CLIENT_ID/SECRET/REDIRECT_URI/AUDIENCE/REQUIRED_ACR).',
      503,
    );
  }
  const jar = await cookies();
  const token = jar.get(PLATFORM_ACCESS_COOKIE)?.value?.trim() ?? '';
  if (!token) {
    return bffApiError(
      PLATFORM_ERROR_CODES.UNAUTHENTICATED,
      'Platform session missing — sign in via /api/auth/platform/login.',
      401,
    );
  }
  const base = apiBaseUrl();
  const url = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  try {
    const upstream = await fetch(url, { ...init, headers, cache: 'no-store' });
    const contentType =
      upstream.headers.get('Content-Type') ?? 'application/json';
    const out = new Headers({
      'Content-Type': contentType,
      'Cache-Control':
        upstream.headers.get('Cache-Control') ?? 'private, no-store',
    });
    const disposition = upstream.headers.get('Content-Disposition');
    if (disposition) out.set('Content-Disposition', disposition);
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: upstream.status, headers: out });
  } catch {
    return bffApiError(
      PLATFORM_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      `Cannot reach platform API ${init.method ?? 'GET'} ${url}.`,
      502,
      true,
    );
  }
}

/** Tenant-admin BFF may use attendee cookie (Owner MFA on same or tenant client). */
export { forwardWithBearer as forwardTenantBearer } from '../bff/upstream';
