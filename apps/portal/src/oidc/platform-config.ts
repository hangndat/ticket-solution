type EnvBag = Record<string, string | undefined>;

/** Default matches backend PLATFORM_MFA_AUTH_TIME_MAX (15m) / security policy. */
export const DEFAULT_PLATFORM_MFA_AUTH_TIME_MAX_SECONDS = 900;

export type PlatformOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  audience: string;
  requiredAcr: string;
  jwksUrl: string;
  maxAuthAgeSeconds: number;
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
  const jwksUrl =
    env.PLATFORM_OIDC_JWKS_URL?.trim() || env.OIDC_JWKS_URL?.trim() || '';
  const scopes =
    env.PLATFORM_OIDC_SCOPES?.trim() || 'openid profile email offline_access';
  const maxAuthRaw =
    env.PLATFORM_MFA_AUTH_TIME_MAX_SECONDS?.trim() ||
    String(DEFAULT_PLATFORM_MFA_AUTH_TIME_MAX_SECONDS);
  const maxAuthAgeSeconds = Number(maxAuthRaw);
  if (
    !issuer ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !audience ||
    !requiredAcr ||
    !jwksUrl ||
    !Number.isFinite(maxAuthAgeSeconds) ||
    maxAuthAgeSeconds < 60 ||
    maxAuthAgeSeconds > 3600
  ) {
    return null;
  }
  try {
    const url = new URL(jwksUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
  } catch {
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
    jwksUrl,
    maxAuthAgeSeconds: Math.floor(maxAuthAgeSeconds),
  };
}

export function isPlatformOidcConfigured(env: EnvBag = process.env): boolean {
  return readPlatformOidcConfig(env) !== null;
}
