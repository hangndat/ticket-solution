/**
 * Pure env checks for self-hosted Keycloak OIDC (web BFF).
 * No SDK imports — safe for unit tests and fail-closed UI.
 */

type OidcEnvBag = Record<string, string | undefined>;

export type OidcWebConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  /** Access-token audience — Nest API (`ticket-api`). */
  audience: string;
  jwksUrl: string;
};

export function readOidcWebConfig(
  env: OidcEnvBag = process.env,
): OidcWebConfig | null {
  const issuer = env.OIDC_ISSUER?.trim() ?? '';
  const clientId = env.OIDC_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim() ?? '';
  const redirectUri = env.OIDC_REDIRECT_URI?.trim() ?? '';
  const audience = env.OIDC_AUDIENCE?.trim() ?? '';
  const jwksUrl =
    env.OIDC_JWKS_URL?.trim() ||
    (issuer
      ? `${discoveryBase(issuer)}/protocol/openid-connect/certs`
      : '');
  const scopes =
    env.OIDC_SCOPES?.trim() || 'openid profile email';
  if (
    !issuer ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !audience ||
    !jwksUrl
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
    jwksUrl,
  };
}

export function isOidcConfigured(env: OidcEnvBag = process.env): boolean {
  return readOidcWebConfig(env) !== null;
}

export type WebAuthState =
  | { status: 'unconfigured'; authenticated: false }
  | { status: 'signed_out'; authenticated: false }
  | { status: 'signed_in'; authenticated: true; subject: string };

/**
 * Resolve display/auth state. Missing OIDC env always yields unconfigured
 * (never authenticated), even if a subject is somehow present.
 */
export function resolveWebAuthState(input: {
  configured: boolean;
  subject: string | null | undefined;
}): WebAuthState {
  if (!input.configured) {
    return { status: 'unconfigured', authenticated: false };
  }
  if (!input.subject) {
    return { status: 'signed_out', authenticated: false };
  }
  return {
    status: 'signed_in',
    authenticated: true,
    subject: input.subject,
  };
}

export function discoveryBase(issuer: string): string {
  return issuer.replace(/\/+$/, '');
}
