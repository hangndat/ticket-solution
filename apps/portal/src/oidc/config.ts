/**
 * Staff portal OIDC env (ticket-admin-web). Fail-closed when incomplete.
 * Never invent mock credentials.
 */

type OidcEnvBag = Record<string, string | undefined>;

export type PortalOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

export function readPortalOidcConfig(
  env: OidcEnvBag = process.env,
): PortalOidcConfig | null {
  const issuer = env.OIDC_ISSUER?.trim() ?? '';
  const clientId = env.OIDC_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim() ?? '';
  const redirectUri = env.OIDC_REDIRECT_URI?.trim() ?? '';
  const scopes = env.OIDC_SCOPES?.trim() || 'openid profile email offline_access';
  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { issuer, clientId, clientSecret, redirectUri, scopes };
}

export function isPortalOidcConfigured(env: OidcEnvBag = process.env): boolean {
  return readPortalOidcConfig(env) !== null;
}

export type PortalAuthState =
  | { status: 'unconfigured'; authenticated: false }
  | { status: 'signed_out'; authenticated: false }
  | { status: 'signed_in'; authenticated: true };

export function resolvePortalAuthState(input: {
  configured: boolean;
  hasAccessToken: boolean;
}): PortalAuthState {
  if (!input.configured) {
    return { status: 'unconfigured', authenticated: false };
  }
  if (!input.hasAccessToken) {
    return { status: 'signed_out', authenticated: false };
  }
  return { status: 'signed_in', authenticated: true };
}

export function discoveryBase(issuer: string): string {
  return issuer.replace(/\/+$/, '');
}

/** Product (app.) origin for Gate deep-links — never invent production host. */
export function productOrigin(env: OidcEnvBag = process.env): string {
  const raw = env.PRODUCT_ORIGIN?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:3000';
}

export function gateDeeplinkUrl(
  env: OidcEnvBag = process.env,
  path = '/gate',
): string {
  const origin = productOrigin(env);
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/gate';
  return `${origin}${safePath}`;
}
