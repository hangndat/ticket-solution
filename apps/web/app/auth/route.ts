import { NextRequest, NextResponse } from 'next/server';
import { isOidcConfigured } from '../../src/oidc/config';
import { loginHref } from '../../src/oidc/login-href';
import {
  pathWithNotice,
  authNoticeFromParam,
} from '../../src/oidc/auth-notice';
import { clearSessionCookies } from '../../src/oidc/cookies';
import { sanitizePostLoginPath } from '../../src/oidc/post-login';
import { clearSsrRefreshAttempt } from '../../src/oidc/session-refresh';

/**
 * Thin redirect stub — no guest product UI on `/auth` (UX-UI revamp / AC-S1).
 * HTTP 307 so clients/tests see a real redirect (not RSC flight-only).
 */
export const dynamic = 'force-dynamic';

function resolveReturnPath(
  rawNext: string | null,
  rawReturn: string | null,
): string | null {
  return (
    sanitizePostLoginPath(rawReturn) ?? sanitizePostLoginPath(rawNext) ?? null
  );
}

function noticeLandingPath(returnPath: string | null, notice: string): string {
  const path = returnPath ?? '/';
  if (path === '/admin' || path === '/auth') {
    return pathWithNotice('/', notice);
  }
  return pathWithNotice(path, notice);
}

function absolute(request: NextRequest, path: string): URL {
  return new URL(path, request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const returnPath = resolveReturnPath(
    searchParams.get('next'),
    searchParams.get('return'),
  );
  const oauthError = searchParams.get('error')?.trim() ?? '';
  const noticeParam = searchParams.get('notice')?.trim() ?? '';

  if (oauthError) {
    if (oauthError === 'session_rejected') {
      await clearSessionCookies();
      await clearSsrRefreshAttempt();
    }
    return NextResponse.redirect(
      absolute(request, noticeLandingPath(returnPath, 'auth_failed')),
      307,
    );
  }

  if (noticeParam && authNoticeFromParam(noticeParam)) {
    return NextResponse.redirect(
      absolute(request, noticeLandingPath(returnPath, noticeParam)),
      307,
    );
  }

  if (returnPath) {
    if (!isOidcConfigured()) {
      return NextResponse.redirect(
        absolute(request, noticeLandingPath(returnPath, 'auth_unavailable')),
        307,
      );
    }
    return NextResponse.redirect(absolute(request, loginHref(returnPath)), 307);
  }

  if (!isOidcConfigured()) {
    return NextResponse.redirect(
      absolute(request, pathWithNotice('/', 'auth_unavailable')),
      307,
    );
  }

  return NextResponse.redirect(absolute(request, '/'), 307);
}
