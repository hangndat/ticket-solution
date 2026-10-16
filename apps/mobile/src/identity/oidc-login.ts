import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  getOidcClientId,
  getOidcIssuer,
  getOidcScopes,
} from './config';

WebBrowser.maybeCompleteAuthSession();

export type OidcLoginResult =
  | { ok: true; accessToken: string; refreshToken: string | null }
  | { ok: false; reason: string };

/**
 * Authorization Code + PKCE against self-hosted Keycloak.
 * Returns short-lived access token for SessionBoundary.establish → /v1/me.
 */
export async function loginWithKeycloak(): Promise<OidcLoginResult> {
  const issuer = getOidcIssuer();
  const clientId = getOidcClientId();
  if (!issuer || !clientId) {
    return { ok: false, reason: 'OIDC is not configured.' };
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'ticketsolution',
    path: 'oauth/callback',
  });

  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: getOidcScopes().split(/\s+/).filter(Boolean),
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    return {
      ok: false,
      reason:
        result.type === 'dismiss' || result.type === 'cancel'
          ? 'Sign-in cancelled.'
          : 'Authorization failed.',
    };
  }

  if (!request.codeVerifier) {
    return { ok: false, reason: 'PKCE verifier missing after authorize.' };
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier,
      },
    },
    discovery,
  );

  if (!token.accessToken) {
    return { ok: false, reason: 'Token response missing access_token.' };
  }

  return {
    ok: true,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? null,
  };
}

export async function endKeycloakSession(): Promise<void> {
  const issuer = getOidcIssuer();
  const clientId = getOidcClientId();
  if (!issuer || !clientId) return;

  try {
    const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
    if (!discovery.endSessionEndpoint) return;
    const postLogout = AuthSession.makeRedirectUri({
      scheme: 'ticketsolution',
      path: 'oauth/logout',
    });
    const url = new URL(discovery.endSessionEndpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('post_logout_redirect_uri', postLogout);
    await WebBrowser.openAuthSessionAsync(url.toString(), postLogout);
  } catch {
    /* Best-effort RP-initiated logout; local SecureStore already cleared. */
  }
}
