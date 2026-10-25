import type { TenantBranding } from './types';

/**
 * Canonical Vemoki defaults from brand/vemoki/tokens.json (Live Pulse v2).
 * Keep in sync with apps/web/app/globals.css :root — branding-theme test.
 * Default product mark: approved raster in `public/marketing/neon/` (BrandMark);
 * app icons in `app/icon.png` / `app/apple-icon.png` (Logo Kit, approved-original).
 */
export const VEMOKI_DEFAULT_MARK_PATH = '/marketing/neon/vemoki-v-mark.png';
export const VEMOKI_DEFAULT_MARK_WEBP_PATH = '/marketing/neon/vemoki-v-mark.webp';
export const VEMOKI_PRODUCT_MARK_WIDTH = 128;
export const VEMOKI_PRODUCT_MARK_HEIGHT = 111;

export const VEMOKI_BRANDING: TenantBranding = {
  wordmark: 'Vemoki',
  displayName: 'Vemoki',
  signalGlyph: '',
  colors: {
    ink: '#0B1220',
    paper: '#F4F6F8',
    signal: '#7C4DED',
    focus: '#2563EB',
  },
  primaryColor: '#7C4DED',
  secondaryColor: '#2563EB',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
