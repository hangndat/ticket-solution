type EnvBag = Record<string, string | undefined>;

export type PlatformOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  audience: string;
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
    env.PLATFORM_OIDC_SCOPES?.trim() || 'openid profile email offline_access';
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
