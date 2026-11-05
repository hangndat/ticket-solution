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
    ink: '#141020',
    paper: '#FFFFFF',
    signal: '#6C35FF',
    focus: '#5B22F0',
  },
  primaryColor: '#6C35FF',
  secondaryColor: '#5B22F0',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
