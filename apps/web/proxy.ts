import { NextResponse, type NextRequest } from 'next/server';
import {
  decideHostRouting,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  productOriginFromEnv,
} from './src/marketing/hosts';
/** Keep literal — avoid importing next/headers via oidc/cookies in Edge proxy. */
const OIDC_ACCESS_COOKIE = 'oidc_access_token';

/**
 * Next.js 16 proxy — O13 host-aware marketing vs product.
 * OIDC session remains HttpOnly cookies on product host only (no Domain=.vemoki.com).
 * O02: anonymous soft-redirect for staff deep-links /admin|/gate → /auth
 * (product host only — after apex→app host redirects).
 */
export default function proxy(request: NextRequest) {
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

  // Soft-redirect anonymous staff + owner-ticket deeplinks on product surface only.
  const ownerTicketPath =
    /^\/t\/[a-z0-9][a-z0-9-]{0,62}\/tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pathname,
    );
  if (pathname === '/admin' || pathname === '/gate' || ownerTicketPath) {
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
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  // Already-internal /marketing… — pass through with surface headers (no self-rewrite).
  if (decision.type === 'next' && decision.surface === 'marketing') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-vemoki-surface', 'marketing');
    requestHeaders.set('x-vemoki-locale', decision.locale);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
