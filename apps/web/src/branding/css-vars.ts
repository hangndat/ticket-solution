import type { CSSProperties } from 'react';
import type { TenantBranding } from './types';

/**
 * Map branding → CSS custom properties used by globals.css.
 * Preserves D6 token names (--ink/--paper/--signal/--focus/--brand).
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
