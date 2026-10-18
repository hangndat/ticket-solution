import { NextRequest, NextResponse } from 'next/server';
import { discoveryBase } from '../../../../../src/oidc/config';
import {
  clearPlatformSessionCookies,
  readPlatformIdToken,
  readPlatformRefreshToken,
} from '../../../../../src/oidc/cookies';
import {
  isPlatformOidcConfigured,
  readPlatformOidcConfig,
} from '../../../../../src/oidc/platform-config';
import { requirePublicOrigin } from '../../../../../src/oidc/public-origin';

async function bestEffortRevokeRefresh(
  issuer: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<void> {
  try {
    const revokeUrl = `${discoveryBase(issuer)}/protocol/openid-connect/revoke`;
    await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
      cache: 'no-store',
    });
  } catch {
    /* best-effort */
  }
}

/** Clear platform cookies only — does not touch staff oidc_* jar. */
export async function GET(request: NextRequest) {
  const originResult = requirePublicOrigin(request);
  if (!originResult.ok) return originResult.response;
  const origin = originResult.origin;

  const idToken = (await readPlatformIdToken()) ?? '';
  const refresh = (await readPlatformRefreshToken()) ?? '';

  if (isPlatformOidcConfigured() && refresh) {
    const config = readPlatformOidcConfig()!;
    await bestEffortRevokeRefresh(
      config.issuer,
      config.clientId,
      config.clientSecret,
      refresh,
    );
  }

  await clearPlatformSessionCookies();

  if (!isPlatformOidcConfigured()) {
    return NextResponse.redirect(new URL('/platform', origin));
  }

  const config = readPlatformOidcConfig()!;
  const postLogout = new URL('/platform', origin).toString();
  const endSession = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/logout`,
  );
  endSession.searchParams.set('client_id', config.clientId);
  endSession.searchParams.set('post_logout_redirect_uri', postLogout);
  if (idToken) {
    endSession.searchParams.set('id_token_hint', idToken);
  }

  return NextResponse.redirect(endSession.toString());
}
