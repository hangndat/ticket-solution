import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireSessionRedirectOrigin } from '../../../../src/oidc/public-origin';
import {
  POST_LOGIN_COOKIE,
  sanitizePostLoginPath,
} from '../../../../src/oidc/post-login';
import { refreshWebAccessToken } from '../../../../src/oidc/refresh';
import { clearSessionCookies } from '../../../../src/oidc/cookies';
import {
  fetchStaffStatus,
  staffPortalLoginUrl,
} from '../../../../src/oidc/staff-gate';
import { apiBaseUrl } from '../../../../src/bff/upstream';
import { portalOriginFromEnv } from '../../../../src/portal/dual-run';
import {
  clearSsrRefreshAttempt,
  markSsrRefreshAttempt,
  ssrTerminalAuthRejectPath,
} from '../../../../src/oidc/session-refresh';

/**
 * GET /api/auth/refresh?next=/events (retired paths like /gate sanitize to /)
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

  // A rotated token must pass the same authoritative staff decision as the
  // initial callback. Never leave a refreshed staff token in the web jar.
  const staffStatus = await fetchStaffStatus({
    accessToken: refreshed.accessToken,
    apiBaseUrl: apiBaseUrl(),
  });
  if (staffStatus !== 'attendee') {
    await clearSessionCookies();
    (await cookies()).delete(POST_LOGIN_COOKIE);
    await clearSsrRefreshAttempt();
    if (staffStatus === 'staff') {
      const portalLogin = staffPortalLoginUrl(origin, portalOriginFromEnv());
      if (portalLogin) return NextResponse.redirect(portalLogin);
      console.error('[auth/refresh] staff portal origin unavailable');
      return NextResponse.redirect(
        new URL('/auth?error=portal_unavailable', origin),
      );
    }
    console.error('[auth/refresh] me/tenants staff check unavailable');
    return NextResponse.redirect(
      new URL('/auth?error=staff_check_unavailable', origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
