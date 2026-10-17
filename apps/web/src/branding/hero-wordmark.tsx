'use client';

import { BrandMark } from '../brand-mark';
import { useBranding } from './theme-provider';

/** Home hero lockup — same tokens as SiteNav Wordmark. */
export function HeroWordmark() {
  const branding = useBranding();
  return (
    <p
      className="wordmark-hero"
      aria-hidden="true"
      data-testid="hero-wordmark"
      data-branding-source={branding.source}
    >
      <BrandMark />
      {branding.wordmark}
      {branding.signalGlyph ? <span>{branding.signalGlyph}</span> : null}
    </p>
  );
}
