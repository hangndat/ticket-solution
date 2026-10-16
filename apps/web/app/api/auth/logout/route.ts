import { NextRequest, NextResponse } from 'next/server';
import {
  discoveryBase,
  isOidcConfigured,
  readOidcWebConfig,
} from '../../../../src/oidc/config';
import { clearSessionCookies, publicOrigin } from '../../../../src/oidc/cookies';

/** Clear BFF cookies and redirect to Keycloak end-session when configured. */
export async function GET(request: NextRequest) {
  await clearSessionCookies();

  if (!isOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth', publicOrigin(request)));
  }

  const config = readOidcWebConfig()!;
  const postLogout = new URL('/auth', publicOrigin(request)).toString();
  const endSession = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/logout`,
  );
  endSession.searchParams.set('client_id', config.clientId);
  endSession.searchParams.set('post_logout_redirect_uri', postLogout);

  return NextResponse.redirect(endSession.toString());
}
