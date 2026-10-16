import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isClerkConfigured } from './src/clerk/config';

/**
 * Next.js 16 proxy convention + Clerk session cookies (HttpOnly).
 * When Clerk keys are missing, pass through — fail closed in UI/BFF, not here.
 */
function passthrough() {
  return NextResponse.next();
}

export default isClerkConfigured() ? clerkMiddleware() : passthrough;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
