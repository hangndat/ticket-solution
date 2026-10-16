import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  discoveryBase,
  isOidcConfigured,
  readOidcWebConfig,
} from '../../../../src/oidc/config';
import {
  PKCE_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
} from '../../../../src/oidc/cookies';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
} from '../../../../src/oidc/pkce';

/** Start Authorization Code + PKCE against Keycloak; sets short-lived cookies. */
export async function GET() {
  if (!isOidcConfigured()) {
    return NextResponse.json(
      {
        code: 'OIDC_MISCONFIGURED',
        message: 'OIDC chưa cấu hình — thiếu issuer/client/secret/redirect.',
      },
      { status: 503 },
    );
  }

  const config = readOidcWebConfig()!;
  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  const challenge = codeChallengeS256(verifier);

  const jar = await cookies();
  const shortLived = sessionCookieOptions(600);
  jar.set(PKCE_COOKIE, verifier, shortLived);
  jar.set(STATE_COOKIE, state, shortLived);

  const authorize = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/auth`,
  );
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', config.scopes);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authorize.toString());
}
