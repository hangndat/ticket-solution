import type { CSSProperties } from 'react';
import { brandingFromEventBrand } from './parse';
import type { TenantBranding } from './types';

/**
 * Map branding → CSS custom properties used by globals.css.
 * Preserves Live Pulse token names (--ink/--paper/--signal/--focus/--brand).
 */
export function brandingToCssVars(branding: TenantBranding): CSSProperties {
  return {
    ['--ink' as string]: branding.colors.ink,
    ['--paper' as string]: branding.colors.paper,
    ['--signal' as string]: branding.colors.signal,
    ['--focus' as string]: branding.colors.focus,
    ['--brand' as string]: branding.primaryColor,
  };
}

/**
 * Event content uses the published primary for Tailwind's color-primary
 * utilities. Apply this only to the event main so platform chrome stays global.
 */
export function eventBrandingToCssVars(
  branding: TenantBranding,
): CSSProperties {
  return {
    ...brandingToCssVars(branding),
    ['--color-primary' as string]: 'var(--brand)',
  };
}

/** Build both the event context value and its scoped CSS from published data. */
export function eventBrandingPresentation(
  brand: { primaryColor: string; organizationName: string },
  tenantSlug: string,
): { branding: TenantBranding; style: CSSProperties } {
  const branding = brandingFromEventBrand(brand, tenantSlug);
  return { branding, style: eventBrandingToCssVars(branding) };
}

/** Serialize for non-React sinks (tests / inline style attribute). */
export function brandingCssVarEntries(
  branding: TenantBranding,
): Array<[string, string]> {
  return [
    ['--ink', branding.colors.ink],
    ['--paper', branding.colors.paper],
    ['--signal', branding.colors.signal],
    ['--focus', branding.colors.focus],
    ['--brand', branding.primaryColor],
  ];
}
