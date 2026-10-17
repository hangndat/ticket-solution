/**
 * Platform operator OIDC (separate client/audience from attendee ticket-web).
 * Fail closed when PLATFORM_OIDC_* missing — never invent MFA claims.
 */

type EnvBag = Record<string, string | undefined>;

export type PlatformOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  /** Expected OIDC audience for platform API tokens (e.g. ticket-platform-api). */
  audience: string;
  /** Required ACR value proving MFA step-up (deployment-fixed). */
  requiredAcr: string;
};

export function readPlatformOidcConfig(
  env: EnvBag = process.env,
): PlatformOidcConfig | null {
  const issuer =
    env.PLATFORM_OIDC_ISSUER?.trim() || env.OIDC_ISSUER?.trim() || '';
  const clientId = env.PLATFORM_OIDC_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.PLATFORM_OIDC_CLIENT_SECRET?.trim() ?? '';
  const redirectUri = env.PLATFORM_OIDC_REDIRECT_URI?.trim() ?? '';
  const audience = env.PLATFORM_OIDC_AUDIENCE?.trim() ?? '';
  const requiredAcr = env.PLATFORM_OIDC_REQUIRED_ACR?.trim() ?? '';
  const scopes =
    env.PLATFORM_OIDC_SCOPES?.trim() ||
    'openid profile email offline_access';
  if (
    !issuer ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !audience ||
    !requiredAcr
  ) {
    return null;
  }
  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    audience,
    requiredAcr,
  };
}

export function isPlatformOidcConfigured(env: EnvBag = process.env): boolean {
  return readPlatformOidcConfig(env) !== null;
}

export const PLATFORM_ACCESS_COOKIE = 'platform_oidc_access';
export const PLATFORM_REFRESH_COOKIE = 'platform_oidc_refresh';
export const PLATFORM_PKCE_COOKIE = 'platform_oidc_pkce';
export const PLATFORM_STATE_COOKIE = 'platform_oidc_state';
