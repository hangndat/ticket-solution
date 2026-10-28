import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRedirectOrigin } from '../../../../src/oidc/public-origin';
import { sanitizePostLoginPath } from '../../../../src/oidc/post-login';
import { refreshWebAccessToken } from '../../../../src/oidc/refresh';
import { clearSessionCookies } from '../../../../src/oidc/cookies';
import {
  clearSsrRefreshAttempt,
  markSsrRefreshAttempt,
  ssrTerminalAuthRejectPath,
} from '../../../../src/oidc/session-refresh';

/**
 * GET /api/auth/refresh?next=/gate|/wallet|… (allowlisted via sanitizePostLoginPath)
 * Route Handler — may rotate HttpOnly session cookies (forbidden in RSC).
 */
export async function GET(request: NextRequest) {
  const originResult = requireSessionRedirectOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  const rawNext = request.nextUrl.searchParams.get('next');
  const nextPath = sanitizePostLoginPath(rawNext) ?? '/';

  await markSsrRefreshAttempt();
  const refreshed = await refreshWebAccessToken();
  if (!refreshed.ok) {
    await clearSessionCookies();
    await clearSsrRefreshAttempt();
    return NextResponse.redirect(
      new URL(ssrTerminalAuthRejectPath(nextPath), origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
