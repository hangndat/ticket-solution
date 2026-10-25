import type { TenantBranding } from './types';

/**
 * Canonical Vemoki defaults from brand/vemoki/tokens.json (Live Pulse v2).
 * Keep in sync with apps/web/app/globals.css :root — branding-theme test.
 * Default product mark: gradient V in `BrandMark` (SVG); raster twins in
 * `app/icon.png` / `app/apple-icon.png` (Vemoki Logo Kit, approved-original).
 */
export const VEMOKI_DEFAULT_MARK_PATH = '/icon.png';

export const VEMOKI_BRANDING: TenantBranding = {
  wordmark: 'vemoki',
  displayName: 'Vemoki',
  signalGlyph: '↗',
  colors: {
    ink: '#0B1220',
    paper: '#F4F6F8',
    signal: '#E11D48',
    focus: '#2563EB',
  },
  primaryColor: '#E11D48',
  secondaryColor: '#2563EB',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
