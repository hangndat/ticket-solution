type TicketPublicExtra = {
  apiBaseUrl?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcScopes?: string;
  tenantId?: string;
  eventId?: string;
  pushProvider?: string;
  apsEnvironment?: 'development' | 'production';
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

/** Nest API base URL for GET /v1/me (no trailing slash). */
export function getApiBaseUrl(): string | null {
  const url = pickPublic(
    process.env.EXPO_PUBLIC_API_BASE_URL,
    readTicketPublicExtra().apiBaseUrl,
  );
  return url ? url.replace(/\/+$/, '') : null;
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
 * Public tenant slug for branding / published catalog.
 * Empty → ThemeProvider keeps Vemoki defaults (no invented tenant).
 */
export function getTenantSlug(): string | null {
  const slug = process.env.EXPO_PUBLIC_TENANT_SLUG?.trim() ?? '';
  return slug.length > 0 ? slug : null;
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
  const fromEnv =
    process.env.EXPO_PUBLIC_APS_ENVIRONMENT?.trim() ||
    process.env.APS_ENVIRONMENT?.trim() ||
    process.env.APP_VARIANT?.trim() ||
    '';
  if (fromEnv === 'production') return 'production';
  const fromExtra = readTicketPublicExtra().apsEnvironment;
  return fromExtra === 'production' ? 'production' : 'development';
}

/**
 * W0 demo fixtures (demo-mfest / Studio Night) stay for local/dev deep links.
 * Release / TestFlight must not surface them on the home Events list.
 */
export function showDemoEventCatalog(): boolean {
  return getApsEnvironment() !== 'production';
}
