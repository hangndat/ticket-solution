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
import { PORTAL_AUTH_COOKIES } from '../../../../src/oidc/local-cookies';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
  generateOidcNonce,
} from '../../../../src/oidc/pkce';
import { sanitizePortalReturnPath } from '../../../../src/oidc/return-path';

/** Start Authorization Code + PKCE (S256) + nonce for ticket-admin-web. */
export async function GET(request: NextRequest) {
  if (!isPortalOidcConfigured()) {
    return NextResponse.json(
      {
        code: 'OIDC_MISCONFIGURED',
        message:
          'OIDC chưa cấu hình — thiếu issuer/client/secret/redirect/audience/jwks cho portal.',
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const config = readPortalOidcConfig()!;
  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  const nonce = generateOidcNonce();
  const challenge = codeChallengeS256(verifier);

  const jar = await cookies();
  const shortLived = sessionCookieOptions(600);
  jar.set(SESSION_COOKIES.pkce, verifier, shortLived);
  jar.set(SESSION_COOKIES.state, state, shortLived);
  jar.set(PORTAL_AUTH_COOKIES.nonce, nonce, shortLived);

  const returnPath = sanitizePortalReturnPath(
    request.nextUrl.searchParams.get('return'),
  );
  if (returnPath) {
    jar.set(SESSION_COOKIES.returnPath, returnPath, shortLived);
  } else {
    jar.delete(SESSION_COOKIES.returnPath);
  }

  const authorize = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/auth`,
  );
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', config.scopes);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authorize.toString());
}
