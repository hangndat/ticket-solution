import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './next.config';
import {
  decideHostRouting,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  productOriginFromEnv,
} from './src/marketing/hosts';
import {
  decideAdminToPortalRedirect,
  isNavigationMethod,
  portalOriginFromEnv,
} from './src/portal/dual-run';
import {
  isLegacyStaffApiPath,
  legacyStaffApiGoneResponse,
} from './src/portal/legacy-cutover';
import { isServerActionPost } from './src/security/server-action-edge';
import {
  fetchStaffStatus,
  isConsumerAuthenticatedPath,
  staffPortalLoginUrl,
} from './src/oidc/staff-gate';
import { SESSION_COOKIES } from '@ticket/web-session';
import { WEB_AUTH_COOKIES } from './src/oidc/local-cookies';
const SERVER_ACTION_PROBE_BODY = 'Server Actions are not enabled on this app.';

function clearAttendeeCookies(response: NextResponse): NextResponse {
  for (const name of Object.values(SESSION_COOKIES))
    response.cookies.delete(name);
  response.cookies.delete(WEB_AUTH_COOKIES.subject);
  response.cookies.delete('vemoki_ssr_refresh_attempt');
  return response;
}

function staffGateError(
  request: NextRequest,
  code: 'staff_check_unavailable' | 'portal_unavailable',
): NextResponse {
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    !isNavigationMethod(request.method)
  ) {
    return clearAttendeeCookies(
      NextResponse.json(
        {
          code: code.toUpperCase(),
          message:
            'Không thể xác nhận quyền truy cập. Vui lòng thử đăng nhập lại.',
        },
        { status: 503 },
      ),
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = `?notice=${code}`;
  return clearAttendeeCookies(NextResponse.redirect(url, 302));
}

/** Edge-safe mirror of `bff/upstream.ts#apiBaseUrl` — avoids pulling next/headers into proxy.ts. */
function edgeApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(
    /\/$/,
    '',
  );
}

function withRuntimeCsp(response: NextResponse): NextResponse {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy());
  return response;
}

/**
 * Next.js 16 proxy — O13 host-aware marketing vs product.
 * OIDC session remains HttpOnly cookies on product host only (no Domain=.vemoki.com).
 * D-6: retired web gate — /gate|/gate/* → / (308).
 * O02: anonymous soft-redirect for staff deep-link /admin → /auth
 * (product host only — after apex→app host redirects).
 * ADR-20 §8 / D-7: GET/HEAD /admin|/platform → PORTAL_ORIGIN; legacy staff API → 410.
 */
export default async function proxy(request: NextRequest) {
  if (
    isServerActionPost({
      method: request.method,
      nextActionHeader: request.headers.get('next-action'),
    })
  ) {
    return new NextResponse(SERVER_ACTION_PROBE_BODY, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const hostHeader =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const { pathname, search } = request.nextUrl;

  // O13: marketing host + product path → absolute PRODUCT_ORIGIN first.
  // Must run before O02 soft-redirect, else apex /admin|/gate bounce to
  // relative /auth on vemoki.com (extra hop / wrong surface).
  const decision = decideHostRouting({
    host: hostHeader ?? '',
    pathname,
    search,
    productOrigin: productOriginFromEnv(),
    marketingOrigin: marketingOriginFromEnv(),
    marketingHosts: marketingHostsFromEnv(),
  });

  if (decision.type === 'redirect') {
    return NextResponse.redirect(decision.location, decision.status);
  }

  if (isLegacyStaffApiPath(pathname)) {
    const gone = legacyStaffApiGoneResponse();
    return new NextResponse(gone.body, {
      status: gone.status,
      headers: gone.headers,
    });
  }

  // GET/HEAD admin|platform → portal (D-7); no legacy pages on app host.
  const portalNav = decideAdminToPortalRedirect({
    method: request.method,
    pathname,
    search,
  });
  if (portalNav.type === 'redirect') {
    return NextResponse.redirect(portalNav.location, portalNav.status);
  }
  if (portalNav.type === 'not_found') {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (pathname === '/gate' || pathname.startsWith('/gate/')) {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home, 308);
  }

  // Existing staff sessions may predate callback gating. Probe only protected
  // attendee paths with a session; public browsing remains network-independent.
  if (isConsumerAuthenticatedPath(pathname)) {
    const accessToken = request.cookies.get(SESSION_COOKIES.access)?.value;
    const refreshToken = request.cookies.get(SESSION_COOKIES.refresh)?.value;
    if (!accessToken && refreshToken) {
      if (pathname.startsWith('/api/') || !isNavigationMethod(request.method)) {
        return staffGateError(request, 'staff_check_unavailable');
      }
      const url = request.nextUrl.clone();
      url.pathname = '/api/auth/refresh';
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url, 302);
    }
    if (accessToken) {
      const staffStatus = await fetchStaffStatus({
        accessToken,
        apiBaseUrl: edgeApiBaseUrl(),
      });
      if (staffStatus === 'staff') {
        const portalLogin = staffPortalLoginUrl(
          request.nextUrl.origin,
          portalOriginFromEnv(),
        );
        if (!portalLogin) return staffGateError(request, 'portal_unavailable');
        if (
          pathname.startsWith('/api/') ||
          !isNavigationMethod(request.method)
        ) {
          return clearAttendeeCookies(
            NextResponse.json(
              {
                code: 'STAFF_PORTAL_REQUIRED',
                message: 'Tài khoản nhân viên chỉ sử dụng cổng quản trị.',
              },
              { status: 403 },
            ),
          );
        }
        return clearAttendeeCookies(NextResponse.redirect(portalLogin, 302));
      }
      if (staffStatus === 'unknown') {
        // 401/403 may mean an expired access cookie; allow one refresh hop.
        if (
          refreshToken &&
          !pathname.startsWith('/api/') &&
          isNavigationMethod(request.method)
        ) {
          const url = request.nextUrl.clone();
          url.pathname = '/api/auth/refresh';
          url.search = `?next=${encodeURIComponent(pathname)}`;
          return NextResponse.redirect(url, 302);
        }
        console.error('[proxy] me/tenants staff check unavailable');
        return staffGateError(request, 'staff_check_unavailable');
      }
    }
  }

  if (decision.type === 'rewrite') {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-vemoki-surface', 'marketing');
    requestHeaders.set('x-vemoki-locale', decision.locale);
    return withRuntimeCsp(
      NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      }),
    );
  }

  // Already-internal /marketing… — pass through with surface headers (no self-rewrite).
  if (decision.type === 'next' && decision.surface === 'marketing') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-vemoki-surface', 'marketing');
    requestHeaders.set('x-vemoki-locale', decision.locale);
    return withRuntimeCsp(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
    );
  }

  return withRuntimeCsp(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
