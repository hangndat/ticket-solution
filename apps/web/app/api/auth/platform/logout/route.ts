import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  PLATFORM_ACCESS_COOKIE,
  PLATFORM_PKCE_COOKIE,
  PLATFORM_REFRESH_COOKIE,
  PLATFORM_STATE_COOKIE,
} from '../../../../../src/platform/oidc';

async function clearPlatformCookies() {
  const jar = await cookies();
  jar.delete(PLATFORM_ACCESS_COOKIE);
  jar.delete(PLATFORM_REFRESH_COOKIE);
  jar.delete(PLATFORM_PKCE_COOKIE);
  jar.delete(PLATFORM_STATE_COOKIE);
}

export async function POST() {
  await clearPlatformCookies();
  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function GET(request: NextRequest) {
  await clearPlatformCookies();
  return NextResponse.redirect(new URL('/platform', request.url));
}
