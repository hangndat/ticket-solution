import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicOrigin } from '@ticket/web-session';
import { discoveryBase } from '../../../../../src/oidc/config';
import { clearPlatformSessionCookies } from '../../../../../src/oidc/cookies';
import {
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/oidc/platform-config';

function publicOrigin(request: NextRequest): string {
  return (
    resolvePublicOrigin({ url: request.url }) ?? new URL(request.url).origin
  );
}

/** Clear platform cookies only — does not touch staff oidc_* jar. */
export async function GET(request: NextRequest) {
  await clearPlatformSessionCookies();

  if (!isPlatformOidcConfigured()) {
    return NextResponse.redirect(new URL('/platform', publicOrigin(request)));
  }

  const config = readPlatformOidcConfig()!;
  const postLogout = new URL('/platform', publicOrigin(request)).toString();
  const endSession = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/logout`,
  );
  endSession.searchParams.set('client_id', config.clientId);
  endSession.searchParams.set('post_logout_redirect_uri', postLogout);

  return NextResponse.redirect(endSession.toString());
}
