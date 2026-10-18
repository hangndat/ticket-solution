import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePublicOrigin,
  SESSION_COOKIES,
  sessionCookieOptions,
} from '@ticket/web-session';
import {
  discoveryBase,
  isPortalOidcConfigured,
  readPortalOidcConfig,
} from '../../../../src/oidc/config';
import type { TokenGrantResponse } from '../../../../src/oidc/refresh';
import { sanitizePortalReturnPath } from '../../../../src/oidc/return-path';

function publicOrigin(request: NextRequest): string {
  return (
    resolvePublicOrigin({ url: request.url }) ?? new URL(request.url).origin
  );
}

/** Exchange authorization code; store host-only HttpOnly cookies. */
export async function GET(request: NextRequest) {
  if (!isPortalOidcConfigured()) {
    return NextResponse.redirect(
      new URL('/auth?error=misconfigured', publicOrigin(request)),
    );
  }

  const config = readPortalOidcConfig()!;
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/auth?error=${encodeURIComponent(oauthError)}`,
        publicOrigin(request),
      ),
    );
  }

  const jar = await cookies();
  const expectedState = jar.get(SESSION_COOKIES.state)?.value;
  const verifier = jar.get(SESSION_COOKIES.pkce)?.value;

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier
  ) {
    return NextResponse.redirect(
      new URL('/auth?error=invalid_state', publicOrigin(request)),
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
          `/auth?error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`,
          publicOrigin(request),
        ),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/auth?error=token_exchange', publicOrigin(request)),
    );
  }

  const maxAge = Math.max(60, tokens.expires_in ?? 300);
  jar.set(
    SESSION_COOKIES.access,
    tokens.access_token,
    sessionCookieOptions(maxAge),
  );
  if (tokens.refresh_token) {
    jar.set(
      SESSION_COOKIES.refresh,
      tokens.refresh_token,
      sessionCookieOptions(60 * 60 * 24 * 30),
    );
  }
  if (tokens.id_token) {
    jar.set(
      SESSION_COOKIES.idToken,
      tokens.id_token,
      sessionCookieOptions(maxAge),
    );
  }
  jar.delete(SESSION_COOKIES.pkce);
  jar.delete(SESSION_COOKIES.state);

  const postLogin = sanitizePortalReturnPath(
    jar.get(SESSION_COOKIES.returnPath)?.value,
  );
  jar.delete(SESSION_COOKIES.returnPath);

  return NextResponse.redirect(
    new URL(postLogin ?? '/', publicOrigin(request)),
  );
}
