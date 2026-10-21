import { NextRequest, NextResponse } from 'next/server';
import { requirePublicOrigin } from '../../../../src/oidc/public-origin';
import { sanitizePostLoginPath } from '../../../../src/oidc/post-login';
import { refreshWebAccessToken } from '../../../../src/oidc/refresh';
import {
  clearSsrRefreshAttempt,
  markSsrRefreshAttempt,
} from '../../../../src/oidc/session-refresh';

/**
 * GET /api/auth/refresh?next=/gate
 * Route Handler — may rotate HttpOnly session cookies (forbidden in RSC).
 */
export async function GET(request: NextRequest) {
  const originResult = requirePublicOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  const rawNext = request.nextUrl.searchParams.get('next');
  const nextPath = sanitizePostLoginPath(rawNext) ?? '/';

  await markSsrRefreshAttempt();
  const refreshed = await refreshWebAccessToken();
  if (!refreshed.ok) {
    await clearSsrRefreshAttempt();
    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(nextPath)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
