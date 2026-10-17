import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { discoveryBase } from '../../../../../src/oidc/config';
import { sessionCookieOptions } from '../../../../../src/oidc/cookies';
import {
  PLATFORM_ACCESS_COOKIE,
  PLATFORM_PKCE_COOKIE,
  PLATFORM_REFRESH_COOKIE,
  PLATFORM_STATE_COOKIE,
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/platform/oidc';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

/** Exchange platform auth code; store in platform-* cookies only. */
export async function GET(request: NextRequest) {
  if (!isPlatformOidcConfigured()) {
    return NextResponse.redirect(
      new URL('/platform?error=misconfigured', request.url),
    );
  }
  const config = readPlatformOidcConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/platform?error=${encodeURIComponent(oauthError)}`, request.url),
    );
  }
  const jar = await cookies();
  const expectedState = jar.get(PLATFORM_STATE_COOKIE)?.value;
  const verifier = jar.get(PLATFORM_PKCE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(
      new URL('/platform?error=invalid_state', request.url),
    );
  }

  const tokenUrl = `${discoveryBase(config.issuer)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  let tokens: TokenResponse;
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    tokens = (await response.json()) as TokenResponse;
    if (!response.ok || !tokens.access_token) {
      return NextResponse.redirect(
        new URL(
          `/platform?error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`,
          request.url,
        ),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/platform?error=token_exchange', request.url),
    );
  }

  const maxAge = Math.max(60, tokens.expires_in ?? 300);
  jar.set(PLATFORM_ACCESS_COOKIE, tokens.access_token, sessionCookieOptions(maxAge));
  if (tokens.refresh_token) {
    jar.set(
      PLATFORM_REFRESH_COOKIE,
      tokens.refresh_token,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  jar.delete(PLATFORM_PKCE_COOKIE);
  jar.delete(PLATFORM_STATE_COOKIE);

  return NextResponse.redirect(new URL('/platform', request.url));
}
