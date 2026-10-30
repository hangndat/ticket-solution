import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIES,
  sessionCookieOptions,
} from '@ticket/web-session';
import {
  discoveryBase,
  isPortalOidcConfigured,
  readPortalOidcConfig,
} from '../../../../src/oidc/config';
import { PORTAL_AUTH_COOKIES, staffTokenCookieName } from '../../../../src/oidc/local-cookies';
import { rotateActorEpoch } from '../../../../src/oidc/actor-epoch';
import { requirePublicOrigin } from '../../../../src/oidc/public-origin';
import type { TokenGrantResponse } from '../../../../src/oidc/refresh';
import { sanitizePortalReturnPath } from '../../../../src/oidc/return-path';
import {
  acceptOidcTokenGrant,
  getRemoteJwks,
  TokenVerifyError,
} from '../../../../src/oidc/verify-tokens';

/** Exchange authorization code; verify JWTs; store host-only HttpOnly cookies. */
export async function GET(request: NextRequest) {
  const originResult = requirePublicOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  if (!isPortalOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth?error=misconfigured', origin));
  }

  const config = readPortalOidcConfig()!;
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
  const expectedState = jar.get(SESSION_COOKIES.state)?.value;
  const verifier = jar.get(SESSION_COOKIES.pkce)?.value;
  const nonce = jar.get(PORTAL_AUTH_COOKIES.nonce)?.value;

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier ||
    !nonce
  ) {
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
      nonce,
    });
  } catch (error) {
    jar.delete(SESSION_COOKIES.pkce);
    jar.delete(SESSION_COOKIES.state);
    jar.delete(PORTAL_AUTH_COOKIES.nonce);
    const reason =
      error instanceof TokenVerifyError ? error.reason : 'token_verify';
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(reason)}`, origin),
    );
  }

  const maxAge = grant.expiresIn;
  const epoch = await rotateActorEpoch('staff', grant.subject);
  jar.set(
    staffTokenCookieName(SESSION_COOKIES.access, epoch),
    grant.accessToken,
    sessionCookieOptions(maxAge),
  );
  if (grant.refreshToken) {
    jar.set(
      staffTokenCookieName(SESSION_COOKIES.refresh, epoch),
      grant.refreshToken,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (grant.idToken) {
    jar.set(
      staffTokenCookieName(SESSION_COOKIES.idToken, epoch),
      grant.idToken,
      sessionCookieOptions(maxAge),
    );
  }
  jar.set(
    PORTAL_AUTH_COOKIES.subject,
    grant.subject,
    sessionCookieOptions(60 * 60 * 24 * 30),
  );
  // Remove legacy fixed-name cookies; late refreshes only write their old epoch names.
  jar.delete(SESSION_COOKIES.access);
  jar.delete(SESSION_COOKIES.refresh);
  jar.delete(SESSION_COOKIES.idToken);
  jar.delete(SESSION_COOKIES.pkce);
  jar.delete(SESSION_COOKIES.state);
  jar.delete(PORTAL_AUTH_COOKIES.nonce);

  const postLogin = sanitizePortalReturnPath(
    jar.get(SESSION_COOKIES.returnPath)?.value,
  );
  jar.delete(SESSION_COOKIES.returnPath);

  return NextResponse.redirect(new URL(postLogin ?? '/', origin));
}
