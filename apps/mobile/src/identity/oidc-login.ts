import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  getOidcClientId,
  getOidcIssuer,
  getOidcScopes,
} from './config';
import { OIDC_POST_LOGOUT_URI, OIDC_REDIRECT_SCHEME } from './app-schemes';

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
    return { ok: false, reason: 'Chưa cấu hình OIDC.' };
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: OIDC_REDIRECT_SCHEME,
    path: 'oauth/callback',
  });

  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: getOidcScopes().split(/\s+/).filter(Boolean),
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    // Always show credentials UI so Sign in after Log out can switch accounts
    // (Keycloak SSO cookie alone must not silently reuse the previous attendee).
    prompt: AuthSession.Prompt.Login,
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    return {
      ok: false,
      reason:
        result.type === 'dismiss' || result.type === 'cancel'
          ? 'Đã hủy đăng nhập.'
          : 'Ủy quyền thất bại.',
    };
  }

  if (!request.codeVerifier) {
    return { ok: false, reason: 'Thiếu PKCE verifier sau authorize.' };
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
    return { ok: false, reason: 'Phản hồi token thiếu access_token.' };
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
    // Fixed brand URI (must match Keycloak ticket-mobile allowlist). Do not use
    // AuthSession.makeRedirectUri here — Expo Go / proxy variants were rejected
    // as "Invalid redirect uri" and left the SSO cookie intact.
    const postLogout = OIDC_POST_LOGOUT_URI;
    const url = new URL(discovery.endSessionEndpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('post_logout_redirect_uri', postLogout);
    try {
      await WebBrowser.openAuthSessionAsync(url.toString(), postLogout);
    } catch {
      // Sheet / redirect failure: bare end-session with client_id only (no
      // invalid post_logout_redirect_uri) so Keycloak still clears SSO.
      const bare = new URL(discovery.endSessionEndpoint);
      bare.searchParams.set('client_id', clientId);
      await WebBrowser.openAuthSessionAsync(bare.toString(), postLogout);
    }
  } catch {
    /* Best-effort RP-initiated logout; local SecureStore already cleared. */
  }
}
