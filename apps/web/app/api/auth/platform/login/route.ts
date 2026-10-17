import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { discoveryBase } from '../../../../../src/oidc/config';
import { sessionCookieOptions } from '../../../../../src/oidc/cookies';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
} from '../../../../../src/oidc/pkce';
import {
  PLATFORM_PKCE_COOKIE,
  PLATFORM_STATE_COOKIE,
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/platform/oidc';
import { PLATFORM_ERROR_CODES } from '../../../../../src/platform/contracts';

/**
 * Platform operator login — separate PKCE cookies from attendee session.
 * Requests MFA ACR via Keycloak (kc_acr / acr_values) when configured.
 */
export async function GET() {
  if (!isPlatformOidcConfigured()) {
    return NextResponse.json(
      {
        code: PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
        message:
          'Platform OIDC chưa cấu hình — thiếu PLATFORM_OIDC_* (client/secret/redirect/audience/acr).',
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const config = readPlatformOidcConfig()!;
  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  const challenge = codeChallengeS256(verifier);
  const jar = await cookies();
  const shortLived = sessionCookieOptions(600);
  jar.set(PLATFORM_PKCE_COOKIE, verifier, shortLived);
  jar.set(PLATFORM_STATE_COOKIE, state, shortLived);

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
  // Ask IdP for MFA assurance; backend still verifies acr on API calls.
  authorize.searchParams.set('acr_values', config.requiredAcr);

  return NextResponse.redirect(authorize.toString());
}
