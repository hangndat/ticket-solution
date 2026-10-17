/**
 * Tenant branding DTO for iOS theme (D8-S3).
 *
 * Aligns with:
 * - BE S1 contracts `TenantBranding` — GET /v1/tenants/:tenantId/branding (Bearer)
 * - Web/public flexible shape — GET /v1/public/tenants/:slug/branding (optional logoUrl)
 */
export type TenantBrandingDto = {
  tenantId?: string;
  /** Tenant slug (BE `slug` or public `tenantSlug`); optional when only UUID known. */
  tenantSlug?: string;
  organizationName: string;
  /** Canonical #RRGGBB (lowercase) when present. */
  primaryColor: string;
  secondaryColor?: string | null;
  logoUrl?: string;
  logoAssetId?: string | null;
  /** Optional display wordmark; falls back to organizationName / Vemoki. */
  wordmark?: string;
  brandVersion?: number;
};

export type ThemeSource = 'default' | 'cache' | 'api';

/** Runtime theme tokens applied by ThemeProvider (Vemoki defaults + overrides). */
export type ThemeTokens = {
  ink: string;
  paper: string;
  /** Product accent — tenant primaryColor when valid, else Vemoki signal. */
  signal: string;
  /** Focus — tenant secondaryColor when valid, else Vemoki focus. */
  focus: string;
  wordmark: string;
  signalMark: string;
  organizationName: string;
  logoUrl: string | null;
  logoAssetId: string | null;
  source: ThemeSource;
  tenantSlug: string | null;
  brandVersion: number | null;
};

export type BrandingFetchResult =
  | { status: 'ok'; branding: TenantBrandingDto }
  | { status: 'not-found' }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid' }
  | { status: 'misconfigured' };
