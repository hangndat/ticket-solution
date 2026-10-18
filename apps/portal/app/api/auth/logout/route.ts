import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicOrigin } from '@ticket/web-session';
import {
  discoveryBase,
  isPortalOidcConfigured,
  readPortalOidcConfig,
} from '../../../../src/oidc/config';
import {
  clearStaffSessionCookies,
  readStaffIdToken,
  readStaffRefreshToken,
} from '../../../../src/oidc/cookies';

function publicOrigin(request: NextRequest): string {
  return (
    resolvePublicOrigin({ url: request.url }) ?? new URL(request.url).origin
  );
}

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
    /* revoke is best-effort; local clear still wins */
  }
}

/** Clear staff portal cookies only; RP-initiated end-session for ticket-admin-web. */
export async function GET(request: NextRequest) {
  const idToken = (await readStaffIdToken()) ?? '';
  const refresh = (await readStaffRefreshToken()) ?? '';

  if (isPortalOidcConfigured() && refresh) {
    const config = readPortalOidcConfig()!;
    await bestEffortRevokeRefresh(
      config.issuer,
      config.clientId,
      config.clientSecret,
      refresh,
    );
  }

  await clearStaffSessionCookies();

  if (!isPortalOidcConfigured()) {
    return NextResponse.redirect(new URL('/auth', publicOrigin(request)));
  }

  const config = readPortalOidcConfig()!;
  const postLogout = new URL('/auth', publicOrigin(request)).toString();
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
