import { NextResponse } from 'next/server';

/**
 * Next.js 16 proxy convention. OIDC session is HttpOnly cookies set by
 * /api/auth/* — no Clerk middleware. Fail closed in UI/BFF when env missing.
 */
export default function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
