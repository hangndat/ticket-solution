import { brand as vemokiBrand } from './tokens.ts';
import type { TenantBrandingDto, ThemeSource, ThemeTokens } from './types.ts';

/** Platform default theme (O09 / brand/vemoki/tokens.json). */
export function defaultThemeTokens(): ThemeTokens {
  return {
    ink: vemokiBrand.ink,
    paper: vemokiBrand.paper,
    signal: vemokiBrand.signal,
    focus: vemokiBrand.focus,
    wordmark: vemokiBrand.wordmark,
    signalMark: vemokiBrand.signalMark,
    organizationName: 'Vemoki',
    logoUrl: null,
    logoAssetId: null,
    source: 'default',
    tenantSlug: null,
    brandVersion: null,
  };
}

/**
 * Merge tenant branding onto Vemoki defaults.
 * Invalid/null branding → full default (never partial garbage colors).
 */
export function resolveThemeTokens(
  branding: TenantBrandingDto | null,
  source: ThemeSource = 'api',
): ThemeTokens {
  const base = defaultThemeTokens();
  if (!branding) return base;

  const secondary =
    typeof branding.secondaryColor === 'string' &&
    branding.secondaryColor.length > 0
      ? branding.secondaryColor
      : null;

  return {
    ...base,
    signal: branding.primaryColor,
    focus: secondary ?? base.focus,
    wordmark: branding.wordmark ?? branding.organizationName,
    organizationName: branding.organizationName,
    logoUrl: branding.logoUrl ?? null,
    logoAssetId: branding.logoAssetId ?? null,
    source,
    tenantSlug: branding.tenantSlug?.trim() || null,
    brandVersion: branding.brandVersion ?? null,
  };
}

/** Colors derived from theme for StyleSheet consumers. */
export function themeColors(tokens: ThemeTokens) {
  return {
    label: tokens.ink,
    accent: tokens.signal,
    onAccent: '#ffffff',
    ink: tokens.ink,
    paper: tokens.paper,
    signal: tokens.signal,
    focus: tokens.focus,
    ticketCanvas: tokens.paper,
    ticketInk: tokens.ink,
    admit: '#1b7f4a',
    deny: tokens.signal,
    unknown: '#8a6d3b',
  };
}
