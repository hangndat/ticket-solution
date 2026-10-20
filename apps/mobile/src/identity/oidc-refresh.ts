import { getOidcClientId, getOidcIssuer } from './config.ts';

export type OidcRefreshSuccess = {
  ok: true;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
};

export type OidcRefreshFailure = {
  ok: false;
  /** auth: invalid_grant / revoked; network: transport; config: missing issuer/client */
  reason: 'auth' | 'network' | 'config';
};

export type OidcRefreshResult = OidcRefreshSuccess | OidcRefreshFailure;

export type RefreshOidcTokens = (refreshToken: string) => Promise<OidcRefreshResult>;

function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
  const message =
    typeof record.message === 'string' ? record.message.toLowerCase() : '';
  if (
    code.includes('invalid_grant') ||
    code.includes('invalid_token') ||
    message.includes('invalid_grant') ||
    message.includes('invalid_token')
  ) {
    return true;
  }
  // expo-auth-session TokenError often exposes error / errorCode from the body.
  const nested =
    typeof record.error === 'string' ? record.error.toLowerCase() : '';
  if (nested === 'invalid_grant' || nested === 'invalid_token') return true;
  const errorCode =
    typeof record.errorCode === 'string' ? record.errorCode.toLowerCase() : '';
  if (errorCode === 'invalid_grant' || errorCode === 'invalid_token') return true;
  // HTTP 400/401 from token endpoint after a completed request → auth, not transport.
  if (record.status === 400 || record.status === 401) return true;
  return false;
}

/**
 * Keycloak refresh_token grant via expo-auth-session discovery + refreshAsync.
 * Never logs token material. AuthSession is loaded lazily so Node unit tests that
 * inject a mock refresh fn do not need the Expo native module at import time.
 */
export const refreshOidcTokens: RefreshOidcTokens = async (refreshToken) => {
  const issuer = getOidcIssuer();
  const clientId = getOidcClientId();
  if (!issuer || !clientId || !refreshToken) {
    return { ok: false, reason: 'config' };
  }

  try {
    const AuthSession = await import('expo-auth-session');
    const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
    const token = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken,
      },
      discovery,
    );
    if (!token.accessToken) {
      return { ok: false, reason: 'auth' };
    }
    return {
      ok: true,
      accessToken: token.accessToken,
      // Keycloak may omit refresh_token on rotation-disabled responses — keep prior.
      refreshToken: token.refreshToken ?? refreshToken,
      expiresIn:
        typeof token.expiresIn === 'number' && Number.isFinite(token.expiresIn)
          ? token.expiresIn
          : null,
    };
  } catch (error) {
    if (isAuthFailure(error)) {
      return { ok: false, reason: 'auth' };
    }
    return { ok: false, reason: 'network' };
  }
};
