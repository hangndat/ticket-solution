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
  /** Access-token audience — staff API (`ticket-api`). */
  audience: string;
  jwksUrl: string;
};

export function readPortalOidcConfig(
  env: OidcEnvBag = process.env,
): PortalOidcConfig | null {
  const issuer = env.OIDC_ISSUER?.trim() ?? '';
  const clientId = env.OIDC_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim() ?? '';
  const redirectUri = env.OIDC_REDIRECT_URI?.trim() ?? '';
  const audience = env.OIDC_AUDIENCE?.trim() ?? '';
  const jwksUrl = env.OIDC_JWKS_URL?.trim() ?? '';
  const scopes = env.OIDC_SCOPES?.trim() || 'openid profile email';
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

/** Product (app.) origin — never invent production host. */
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

const GATE_DEEPLINK_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isGateDeeplinkId(value: string): boolean {
  return GATE_DEEPLINK_ID.test(value);
}

export function gateDeeplinkUrl(
  env: OidcEnvBag = process.env,
  path = '/gate',
  query?: { tenantId?: string; eventId?: string },
): string {
  const origin = productOrigin(env);
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/gate';
  const url = new URL(`${origin}${safePath}`);
  if (query?.tenantId && isGateDeeplinkId(query.tenantId)) {
    url.searchParams.set('tenantId', query.tenantId);
  }
  if (query?.eventId && isGateDeeplinkId(query.eventId)) {
    url.searchParams.set('eventId', query.eventId);
  }
  return url.toString();
}
