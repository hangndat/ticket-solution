import { auth } from '@clerk/nextjs/server';
import { IDENTITY_ERROR_CODES, type ApiError } from '@ticket/contracts';
import { isClerkConfigured } from '../../../../src/clerk/config';

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
 * Same-origin BFF: read Clerk session (HttpOnly cookie), forward JWT to API.
 * Never exposes CLERK_SECRET_KEY or puts access tokens in localStorage.
 */
export async function GET() {
  if (!isClerkConfigured()) {
    return apiError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC chưa cấu hình — thiếu NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY hoặc CLERK_SECRET_KEY.',
      503,
    );
  }

  const session = await auth();
  if (!session.userId) {
    return apiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Not signed in.',
      401,
    );
  }

  const token = await session.getToken();
  if (!token) {
    return apiError(
      IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      'Session has no usable access token.',
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
