import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { buildWebAuthorizeUrl } from '../../../../src/oidc/authorize';
import { isOidcConfigured, readOidcWebConfig } from '../../../../src/oidc/config';
import {
  NONCE_COOKIE,
  PKCE_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
} from '../../../../src/oidc/cookies';
import {
  POST_LOGIN_COOKIE,
  postLoginCookieOptions,
  sanitizePostLoginPath,
} from '../../../../src/oidc/post-login';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOidcNonce,
  generateOAuthState,
} from '../../../../src/oidc/pkce';

/**
 * Start Authorization Code + PKCE against Keycloak; sets short-lived cookies.
 * Optional ?return=/claim (allowlisted) for guest claim login-return.
 */
export async function GET(request: NextRequest) {
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
  const nonce = generateOidcNonce();
  const challenge = codeChallengeS256(verifier);

  const jar = await cookies();
  const shortLived = sessionCookieOptions(600);
  jar.set(PKCE_COOKIE, verifier, shortLived);
  jar.set(STATE_COOKIE, state, shortLived);
  jar.set(NONCE_COOKIE, nonce, shortLived);

  const returnPath = sanitizePostLoginPath(
    request.nextUrl.searchParams.get('return'),
  );
  if (returnPath) {
    jar.set(POST_LOGIN_COOKIE, returnPath, postLoginCookieOptions(600));
  } else {
    jar.delete(POST_LOGIN_COOKIE);
  }

  const authorize = buildWebAuthorizeUrl(config, {
    state,
    nonce,
    codeChallenge: challenge,
  });

  return NextResponse.redirect(authorize.toString());
}
