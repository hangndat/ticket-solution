import type { TenantBranding } from './types';

/**
 * Canonical Vemoki defaults from brand/vemoki/tokens.json (O09).
 * Keep in sync with apps/web/app/globals.css :root — D6 brand test.
 */
export const VEMOKI_BRANDING: TenantBranding = {
  wordmark: 'vemoki',
  displayName: 'Vemoki',
  signalGlyph: '↗',
  colors: {
    ink: '#22241f',
    paper: '#f7f6f1',
    signal: '#9b3a18',
    focus: '#235fd0',
  },
  primaryColor: '#9b3a18',
  secondaryColor: '#235fd0',
  logoUrl: null,
  logoAssetId: null,
  source: 'vemoki-default',
  tenantSlug: null,
};
