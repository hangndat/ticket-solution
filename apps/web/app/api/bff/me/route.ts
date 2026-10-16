import { IDENTITY_ERROR_CODES, type ApiError } from '@ticket/contracts';
import { isOidcConfigured } from '../../../../src/oidc/config';
import { readAccessToken } from '../../../../src/oidc/cookies';

function apiError(
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
 * Same-origin BFF: read OIDC access token (HttpOnly cookie), forward to Nest.
 * Never puts access tokens in localStorage.
 */
export async function GET() {
  if (!isOidcConfigured()) {
    return apiError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC chưa cấu hình — thiếu OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_REDIRECT_URI.',
      503,
    );
  }

  const token = await readAccessToken();
  if (!token) {
    return apiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Not signed in.',
      401,
    );
  }

  const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(
    /\/$/,
    '',
  );

  try {
    const upstream = await fetch(`${base}/v1/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const text = await upstream.text();
    const contentType =
      upstream.headers.get('Content-Type') ?? 'application/json';
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return apiError(
      'UPSTREAM_UNAVAILABLE',
      `Cannot reach API GET ${base}/v1/me.`,
      502,
      true,
    );
  }
}
