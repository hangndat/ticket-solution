type TicketPublicExtra = {
  apiBaseUrl?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcScopes?: string;
  tenantId?: string;
  tenantSlug?: string;
  eventId?: string;
  pushProvider?: string;
  apsEnvironment?: 'development' | 'production';
  allowLocalFixtureApi?: boolean;
  allowUatSessionRoutes?: boolean;
  allowFixtureEventRoutes?: boolean;
};

/**
 * Runtime fallback for Release/TestFlight when Metro did not inline EXPO_PUBLIC_*.
 * Soft-load expo-constants so node:test (no native modules) still runs.
 */
function readTicketPublicExtra(): TicketPublicExtra {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as {
      default?: { expoConfig?: { extra?: { ticketPublic?: TicketPublicExtra } } };
      expoConfig?: { extra?: { ticketPublic?: TicketPublicExtra } };
    };
    const Constants = mod.default ?? mod;
    return Constants.expoConfig?.extra?.ticketPublic ?? {};
  } catch {
    return {};
  }
}

function pickPublic(
  envValue: string | undefined,
  extraValue: string | undefined,
): string | null {
  const value = envValue?.trim() || extraValue?.trim() || '';
  return value.length > 0 ? value : null;
}

/** Keycloak issuer from Expo public env / baked extra. Empty → fail closed. */
export function getOidcIssuer(): string | null {
  const issuer = pickPublic(
    process.env.EXPO_PUBLIC_OIDC_ISSUER,
    readTicketPublicExtra().oidcIssuer,
  );
  return issuer ? issuer.replace(/\/+$/, '') : null;
}

/** Public OIDC client id for iOS (PKCE). */
export function getOidcClientId(): string | null {
  return pickPublic(
    process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
    readTicketPublicExtra().oidcClientId,
  );
}

export function getOidcScopes(): string {
  return (
    pickPublic(
      process.env.EXPO_PUBLIC_OIDC_SCOPES,
      readTicketPublicExtra().oidcScopes,
    ) || 'openid profile email'
  );
}

/** Production API origin (O18 / K-API-02). Ignores legacy EXPO_PUBLIC_* and baked extra. */
export const VEMOKI_PROD_API_BASE_URL = 'https://api.vemoki.com';

function isPinnedProductionApi(url: string): boolean {
  return url.replace(/\/+$/, '') === VEMOKI_PROD_API_BASE_URL;
}

/**
 * Nest API base URL (no trailing slash).
 * K-API-02: retail builds use production. Local fixture API only when
 * `extra.ticketPublic.allowLocalFixtureApi` was baked at config time (development APS).
 */
function resolveAllowLocalFixtureApi(extra: TicketPublicExtra): boolean {
  if (getApsEnvironment() === 'production') return false;
  if (extra.allowLocalFixtureApi === true) return true;
  const flag = process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION?.trim();
  return flag === '1' || flag === 'true';
}

export function resolveApiBaseUrl(
  caps: { allowLocalFixtureApi: boolean },
  env: { EXPO_PUBLIC_API_BASE_URL?: string },
  extra: Pick<TicketPublicExtra, 'apiBaseUrl'>,
): string {
  if (caps.allowLocalFixtureApi) {
    const local = pickPublic(env.EXPO_PUBLIC_API_BASE_URL, extra.apiBaseUrl);
    if (local && !isPinnedProductionApi(local)) {
      return local.replace(/\/+$/, '');
    }
  }
  return VEMOKI_PROD_API_BASE_URL;
}

export function getApiBaseUrl(): string {
  const extra = readTicketPublicExtra();
  return resolveApiBaseUrl(
    { allowLocalFixtureApi: resolveAllowLocalFixtureApi(extra) },
    {
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
    extra,
  );
}

export function getRetailBakeCaps(): {
  allowLocalFixtureApi: boolean;
  allowUatSessionRoutes: boolean;
  allowFixtureEventRoutes: boolean;
} {
  if (getApsEnvironment() === 'production') {
    return {
      allowLocalFixtureApi: false,
      allowUatSessionRoutes: false,
      allowFixtureEventRoutes: false,
    };
  }
  const extra = readTicketPublicExtra();
  return {
    allowLocalFixtureApi: extra.allowLocalFixtureApi === true,
    allowUatSessionRoutes: extra.allowUatSessionRoutes === true,
    allowFixtureEventRoutes: extra.allowFixtureEventRoutes === true,
  };
}

/**
 * Tenant UUID for GET /v1/me/tickets?tenantId= (required by API).
 * Empty → wallet stays empty / prompts config; never invents a tenant.
 */
export function getTenantId(): string | null {
  return pickPublic(
    process.env.EXPO_PUBLIC_TENANT_ID,
    readTicketPublicExtra().tenantId,
  );
}

/**
 * App catalog + branding tenant slug (ADR-19 path param).
 * Env at Metro time, else baked `extra.ticketPublic.tenantSlug` on device builds.
 * Empty → Events fail-closed; ThemeProvider keeps Vemoki defaults.
 * Not interchangeable with `getTenantId()` (wallet UUID).
 */
export function getTenantSlug(): string | null {
  return pickPublic(
    process.env.EXPO_PUBLIC_TENANT_SLUG,
    readTicketPublicExtra().tenantSlug,
  );
}

/** Event UUID used when a scan is a bare ticket id. QR display payloads carry their own. */
export function getEventId(): string | null {
  return pickPublic(
    process.env.EXPO_PUBLIC_EVENT_ID,
    readTicketPublicExtra().eventId,
  );
}

export function isOidcConfigured(): boolean {
  return getOidcIssuer() !== null && getOidcClientId() !== null;
}

/**
 * APS / bake environment for this binary. Prefer Metro-inlined
 * EXPO_PUBLIC_APS_ENVIRONMENT, then baked extra from app.config.ts.
 */
export function getApsEnvironment(): 'development' | 'production' {
  const fromExtra = readTicketPublicExtra().apsEnvironment;
  if (fromExtra === 'production') return 'production';
  // A contradictory development marker cannot mask any production intent.
  if ([
    process.env.EXPO_PUBLIC_APS_ENVIRONMENT,
    process.env.APP_VARIANT,
    process.env.APS_ENVIRONMENT,
  ].some((value) => value?.trim() === 'production')) return 'production';
  return 'development';
}

/**
 * W0 demo fixtures (demo-mfest / Studio Night) stay for local/dev deep links.
 * Release / TestFlight must not surface them on the home Events list.
 */
export function showDemoEventCatalog(): boolean {
  return getApsEnvironment() !== 'production';
}
