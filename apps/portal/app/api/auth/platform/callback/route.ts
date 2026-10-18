import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  PLATFORM_SESSION_COOKIES,
  sessionCookieOptions,
} from '@ticket/web-session';
import { discoveryBase } from '../../../../../src/oidc/config';
import { PLATFORM_AUTH_COOKIES } from '../../../../../src/oidc/local-cookies';
import {
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/oidc/platform-config';
import { requirePublicOrigin } from '../../../../../src/oidc/public-origin';
import type { TokenGrantResponse } from '../../../../../src/oidc/refresh';
import {
  acceptOidcTokenGrant,
  getRemoteJwks,
  TokenVerifyError,
} from '../../../../../src/oidc/verify-tokens';

/** Exchange platform code; verify aud/ACR/nonce; set platform_* cookies only. */
export async function GET(request: NextRequest) {
  const originResult = requirePublicOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  if (!isPlatformOidcConfigured()) {
    return NextResponse.redirect(
      new URL('/platform?error=misconfigured', origin),
    );
  }
  const config = readPlatformOidcConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/platform?error=${encodeURIComponent(oauthError)}`, origin),
    );
  }
  const jar = await cookies();
  const expectedState = jar.get(PLATFORM_SESSION_COOKIES.state)?.value;
  const verifier = jar.get(PLATFORM_SESSION_COOKIES.pkce)?.value;
  const nonce = jar.get(PLATFORM_AUTH_COOKIES.nonce)?.value;
  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier ||
    !nonce
  ) {
    return NextResponse.redirect(
      new URL('/platform?error=invalid_state', origin),
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
          origin,
        ),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/platform?error=token_exchange', origin),
    );
  }

  let grant;
  try {
    grant = await acceptOidcTokenGrant({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      issuer: config.issuer,
      clientId: config.clientId,
      accessAudience: config.audience,
      jwks: getRemoteJwks(config.jwksUrl),
      nonce,
      platform: {
        requiredAcr: config.requiredAcr,
        maxAuthAgeSeconds: config.maxAuthAgeSeconds,
      },
    });
  } catch (error) {
    jar.delete(PLATFORM_SESSION_COOKIES.pkce);
    jar.delete(PLATFORM_SESSION_COOKIES.state);
    jar.delete(PLATFORM_AUTH_COOKIES.nonce);
    const reason =
      error instanceof TokenVerifyError ? error.reason : 'token_verify';
    return NextResponse.redirect(
      new URL(`/platform?error=${encodeURIComponent(reason)}`, origin),
    );
  }

  const maxAge = grant.expiresIn;
  jar.set(
    PLATFORM_SESSION_COOKIES.access,
    grant.accessToken,
    sessionCookieOptions(maxAge),
  );
  if (grant.refreshToken) {
    jar.set(
      PLATFORM_SESSION_COOKIES.refresh,
      grant.refreshToken,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (grant.idToken) {
    jar.set(
      PLATFORM_AUTH_COOKIES.idToken,
      grant.idToken,
      sessionCookieOptions(maxAge),
    );
  }
  jar.set(
    PLATFORM_AUTH_COOKIES.subject,
    grant.subject,
    sessionCookieOptions(60 * 60 * 24 * 30),
  );
  jar.delete(PLATFORM_SESSION_COOKIES.pkce);
  jar.delete(PLATFORM_SESSION_COOKIES.state);
  jar.delete(PLATFORM_AUTH_COOKIES.nonce);

  return NextResponse.redirect(new URL('/platform', origin));
}
