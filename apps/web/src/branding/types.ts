/**
 * Tenant white-label branding (D8-S2).
 * Aligns with BE S1 tenant columns: display_name, primary_color,
 * secondary_color, logo_asset_id — plus optional resolved logoUrl.
 */

export type BrandingSource = 'vemoki-default' | 'tenant' | 'demo-event';

export type TenantBrandingColors = {
  /** Body / chrome text — Vemoki ink unless API expands later */
  ink: string;
  /** Page background — Vemoki paper unless API expands later */
  paper: string;
  /** Accent / wordmark signal — tenant primaryColor when set */
  signal: string;
  /** Focus ring — tenant secondaryColor when set */
  focus: string;
};

export type TenantBranding = {
  /** Wordmark text shown in chrome (lowercase product/org lockup) */
  wordmark: string;
  /** Accessible display name (aria / titles) */
  displayName: string;
  /** Glyph after wordmark (Vemoki ↗); empty string hides it */
  signalGlyph: string;
  colors: TenantBrandingColors;
  /** Maps to --brand (buttons); defaults to signal */
  primaryColor: string;
  /** Optional secondary accent (also drives --focus when set) */
  secondaryColor: string | null;
  /** Same-origin or https logo URL; null → default raster BrandMark */
  logoUrl: string | null;
  logoAssetId: string | null;
  source: BrandingSource;
  tenantSlug: string | null;
};

/** Upstream / BFF JSON shape (deny unknown control fields). */
export type TenantBrandingDto = {
  tenantSlug?: string | null;
  displayName?: string | null;
  wordmark?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  logoAssetId?: string | null;
  signalGlyph?: string | null;
};
