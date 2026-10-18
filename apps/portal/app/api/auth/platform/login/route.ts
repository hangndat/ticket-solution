import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
  generateOidcNonce,
} from '../../../../../src/oidc/pkce';

/** Platform Operator login — separate PKCE/nonce cookies; never mixes staff jar. */
export async function GET() {
  if (!isPlatformOidcConfigured()) {
    return NextResponse.json(
      {
        code: 'PLATFORM_MISCONFIGURED',
        message:
          'Platform OIDC chưa cấu hình — thiếu PLATFORM_OIDC_* (client/secret/redirect/audience/acr/jwks).',
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const config = readPlatformOidcConfig()!;
  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  const nonce = generateOidcNonce();
  const challenge = codeChallengeS256(verifier);
  const jar = await cookies();
  const shortLived = sessionCookieOptions(600);
  jar.set(PLATFORM_SESSION_COOKIES.pkce, verifier, shortLived);
  jar.set(PLATFORM_SESSION_COOKIES.state, state, shortLived);
  jar.set(PLATFORM_AUTH_COOKIES.nonce, nonce, shortLived);

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
  authorize.searchParams.set('acr_values', config.requiredAcr);

  return NextResponse.redirect(authorize.toString());
}
