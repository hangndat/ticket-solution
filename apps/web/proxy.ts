import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './next.config';
import {
  decideHostRouting,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  productOriginFromEnv,
} from './src/marketing/hosts';
import { decideAdminToPortalRedirect } from './src/portal/dual-run';
import { isServerActionPost } from './src/security/server-action-edge';
/** Keep literal — avoid importing next/headers via oidc/cookies in Edge proxy. */
const OIDC_ACCESS_COOKIE = 'oidc_access_token';

const SERVER_ACTION_PROBE_BODY = 'Server Actions are not enabled on this app.';

function withRuntimeCsp(response: NextResponse): NextResponse {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy());
  return response;
}

/**
 * Next.js 16 proxy — O13 host-aware marketing vs product.
 * OIDC session remains HttpOnly cookies on product host only (no Domain=.vemoki.com).
 * O02: anonymous soft-redirect for staff deep-links /admin|/gate → /auth
 * (product host only — after apex→app host redirects).
 * ADR-20 §8: optional GET/HEAD /admin|/platform → PORTAL_ORIGIN (flag default OFF).
 */
export default function proxy(request: NextRequest) {
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

  // ADR-20 dual-run: GET/HEAD admin|platform → portal when flag ON.
  // Before O02 /auth soft-redirect so navigation lands on portal login.
  // Never mutates POST/PUT/PATCH or /api/bff (pure helper enforces).
  const portalNav = decideAdminToPortalRedirect({
    method: request.method,
    pathname,
    search,
  });
  if (portalNav.type === 'redirect') {
    return NextResponse.redirect(portalNav.location, portalNav.status);
  }

  // Soft-redirect anonymous staff deep-links only.
  // Owner-ticket `/t/…/tickets/…` renders login CTA on-page (AC-S2) — do not
  // bounce through `/auth` (stub would loop when returning to the ticket path).
  if (pathname === '/admin' || pathname === '/gate') {
    const token = request.cookies.get(OIDC_ACCESS_COOKIE)?.value?.trim() ?? '';
    if (!token) {
      const auth = request.nextUrl.clone();
      auth.pathname = '/auth';
      auth.search = '';
      auth.searchParams.set('next', pathname);
      return NextResponse.redirect(auth, 307);
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
