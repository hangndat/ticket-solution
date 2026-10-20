import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  discoveryBase,
  isOidcConfigured,
  readOidcWebConfig,
} from '../../../../src/oidc/config';
import { ID_TOKEN_COOKIE, clearSessionCookies } from '../../../../src/oidc/cookies';
import { requirePublicOrigin } from '../../../../src/oidc/public-origin';

/** Clear BFF cookies and redirect to Keycloak end-session when configured. */
export async function GET(request: NextRequest) {
  const originResult = requirePublicOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  const jar = await cookies();
  const idToken = jar.get(ID_TOKEN_COOKIE)?.value?.trim() ?? '';
  await clearSessionCookies();

  if (!isOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth', origin));
  }

  const config = readOidcWebConfig()!;
  const postLogout = new URL('/auth', origin).toString();
  const endSession = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/logout`,
  );
  endSession.searchParams.set('client_id', config.clientId);
  endSession.searchParams.set('post_logout_redirect_uri', postLogout);
  // With id_token_hint Keycloak skips the «Do you want to log out?» confirm.
  if (idToken) {
    endSession.searchParams.set('id_token_hint', idToken);
  }

  return NextResponse.redirect(endSession.toString());
}
