import type { TenantBranding } from './types';

/**
 * Canonical Vemoki defaults from brand/vemoki/tokens.json (Live Pulse v2).
 * Keep in sync with apps/web/app/globals.css :root — branding-theme test.
 */
export const VEMOKI_BRANDING: TenantBranding = {
  wordmark: 'Vemoki',
  displayName: 'Vemoki',
  signalGlyph: '',
  colors: {
    ink: '#0B1220',
    paper: '#F4F6F8',
    signal: '#E11D48',
    focus: '#2563EB',
  },
  primaryColor: '#7C4DED',
  secondaryColor: '#2563EB',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
