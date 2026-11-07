import type { TenantBranding } from './types';

/**
 * Canonical Vemoki defaults from brand/vemoki/tokens.json.
 * Keep in sync with generated @ticket/ui tokens and branding-theme tests.
 */
export const VEMOKI_BRANDING: TenantBranding = {
  wordmark: 'Vemoki',
  displayName: 'Vemoki',
  signalGlyph: '',
  colors: {
    ink: '#17151F',
    paper: '#FFFFFF',
    signal: '#7038FF',
    focus: '#7038FF',
  },
  primaryColor: '#7038FF',
  secondaryColor: '#7038FF',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
