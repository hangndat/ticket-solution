import { NextResponse, type NextRequest } from 'next/server';
import {
  decideHostRouting,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  productOriginFromEnv,
} from './src/marketing/hosts';

/**
 * Next.js 16 proxy — O13 host-aware marketing vs product.
 * OIDC session remains HttpOnly cookies on product host only (no Domain=.vemoki.com).
 */
export default function proxy(request: NextRequest) {
  const hostHeader =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const { pathname, search } = request.nextUrl;

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
