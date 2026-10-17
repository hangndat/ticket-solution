import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  discoveryBase,
  isOidcConfigured,
  readOidcWebConfig,
} from '../../../../src/oidc/config';
import {
  ACCESS_COOKIE,
  PKCE_COOKIE,
  REFRESH_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
} from '../../../../src/oidc/cookies';
import {
  POST_LOGIN_COOKIE,
  sanitizePostLoginPath,
} from '../../../../src/oidc/post-login';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/** Exchange authorization code for tokens; store in HttpOnly cookies. */
export async function GET(request: NextRequest) {
  if (!isOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth?error=misconfigured', request.url));
  }

  const config = readOidcWebConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(oauthError)}`, request.url),
    );
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(PKCE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL('/auth?error=invalid_state', request.url));
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
          `/auth?error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`,
          request.url,
        ),
      );
    }
  } catch {
    return NextResponse.redirect(new URL('/auth?error=token_exchange', request.url));
  }

  const maxAge = Math.max(60, tokens.expires_in ?? 300);
  jar.set(ACCESS_COOKIE, tokens.access_token, sessionCookieOptions(maxAge));
  if (tokens.refresh_token) {
    jar.set(
      REFRESH_COOKIE,
      tokens.refresh_token,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  jar.delete(PKCE_COOKIE);
  jar.delete(STATE_COOKIE);

  const postLogin = sanitizePostLoginPath(jar.get(POST_LOGIN_COOKIE)?.value);
  jar.delete(POST_LOGIN_COOKIE);

  return NextResponse.redirect(
    new URL(postLogin ?? '/auth', request.url),
  );
}
