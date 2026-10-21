import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  discoveryBase,
  isOidcConfigured,
  readOidcWebConfig,
} from '../../../../src/oidc/config';
import {
  ACCESS_COOKIE,
  ID_TOKEN_COOKIE,
  PKCE_COOKIE,
  REFRESH_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
} from '../../../../src/oidc/cookies';
import { WEB_AUTH_COOKIES } from '../../../../src/oidc/local-cookies';
import { requireSessionRedirectOrigin } from '../../../../src/oidc/public-origin';
import {
  POST_LOGIN_COOKIE,
  sanitizePostLoginPath,
} from '../../../../src/oidc/post-login';
import type { TokenGrantResponse } from '../../../../src/oidc/refresh';
import {
  acceptOidcTokenGrant,
  getRemoteJwks,
  TokenVerifyError,
} from '../../../../src/oidc/verify-tokens';

/** Exchange authorization code for tokens; store in HttpOnly cookies. */
export async function GET(request: NextRequest) {
  const originResult = requireSessionRedirectOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  if (!isOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth?error=misconfigured', origin));
  }

  const config = readOidcWebConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(oauthError)}`, origin),
    );
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(PKCE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL('/auth?error=invalid_state', origin));
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
          `/auth?error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`,
          origin,
        ),
      );
    }
  } catch {
    return NextResponse.redirect(new URL('/auth?error=token_exchange', origin));
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
    });
  } catch (error) {
    jar.delete(PKCE_COOKIE);
    jar.delete(STATE_COOKIE);
    const reason =
      error instanceof TokenVerifyError ? error.reason : 'token_verify';
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(reason)}`, origin),
    );
  }

  const maxAge = grant.expiresIn;
  jar.set(ACCESS_COOKIE, grant.accessToken, sessionCookieOptions(maxAge));
  if (grant.refreshToken) {
    jar.set(
      REFRESH_COOKIE,
      grant.refreshToken,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (grant.idToken) {
    jar.set(ID_TOKEN_COOKIE, grant.idToken, sessionCookieOptions(maxAge));
  }
  jar.set(
    WEB_AUTH_COOKIES.subject,
    grant.subject,
    sessionCookieOptions(60 * 60 * 24 * 30),
  );
  jar.delete(PKCE_COOKIE);
  jar.delete(STATE_COOKIE);

  const postLogin = sanitizePostLoginPath(jar.get(POST_LOGIN_COOKIE)?.value);
  jar.delete(POST_LOGIN_COOKIE);

  return NextResponse.redirect(
    new URL(postLogin ?? '/', origin),
  );
}
