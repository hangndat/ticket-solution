'use client';

import { BrandMark } from '../brand-mark';
import { useBranding } from './theme-provider';

/** Home hero lockup — brand-level signal (AC-H1); same tokens as SiteNav. */
export function HeroWordmark() {
  const branding = useBranding();
  const label = branding.displayName || branding.wordmark;
  return (
    <p
      className="wordmark-hero"
      data-testid="hero-wordmark"
      data-branding-source={branding.source}
      aria-label={label}
    >
      <BrandMark />
      {branding.wordmark}
      {branding.signalGlyph ? (
        <span aria-hidden="true">{branding.signalGlyph}</span>
      ) : null}
    </p>
  );
}
