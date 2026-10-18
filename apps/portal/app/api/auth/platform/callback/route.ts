import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  PLATFORM_SESSION_COOKIES,
  resolvePublicOrigin,
  sessionCookieOptions,
} from '@ticket/web-session';
import { discoveryBase } from '../../../../../src/oidc/config';
import {
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/oidc/platform-config';
import type { TokenGrantResponse } from '../../../../../src/oidc/refresh';

function publicOrigin(request: NextRequest): string {
  return (
    resolvePublicOrigin({ url: request.url }) ?? new URL(request.url).origin
  );
}

/** Exchange platform code into platform_* cookies only. */
export async function GET(request: NextRequest) {
  if (!isPlatformOidcConfigured()) {
    return NextResponse.redirect(
      new URL('/platform?error=misconfigured', publicOrigin(request)),
    );
  }
  const config = readPlatformOidcConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/platform?error=${encodeURIComponent(oauthError)}`,
        publicOrigin(request),
      ),
    );
  }
  const jar = await cookies();
  const expectedState = jar.get(PLATFORM_SESSION_COOKIES.state)?.value;
  const verifier = jar.get(PLATFORM_SESSION_COOKIES.pkce)?.value;
  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier
  ) {
    return NextResponse.redirect(
      new URL('/platform?error=invalid_state', publicOrigin(request)),
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

  let tokens: TokenGrantResponse;
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    tokens = (await response.json()) as TokenGrantResponse;
    if (!response.ok || !tokens.access_token) {
      return NextResponse.redirect(
        new URL(
          `/platform?error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`,
          publicOrigin(request),
        ),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/platform?error=token_exchange', publicOrigin(request)),
    );
  }

  const maxAge = Math.max(60, tokens.expires_in ?? 300);
  jar.set(
    PLATFORM_SESSION_COOKIES.access,
    tokens.access_token,
    sessionCookieOptions(maxAge),
  );
  if (tokens.refresh_token) {
    jar.set(
      PLATFORM_SESSION_COOKIES.refresh,
      tokens.refresh_token,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  jar.delete(PLATFORM_SESSION_COOKIES.pkce);
  jar.delete(PLATFORM_SESSION_COOKIES.state);

  return NextResponse.redirect(new URL('/platform', publicOrigin(request)));
}
