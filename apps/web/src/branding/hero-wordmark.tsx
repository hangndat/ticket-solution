'use client';

import { BrandMark } from '../brand-mark';
import { useBranding } from './theme-provider';

type HeroWordmarkProps = {
  /** Catalog home uses compact lockup under the page title block. */
  presentation?: 'hero' | 'catalog';
};

/** Home hero lockup — brand-level signal (AC-H1); same tokens as SiteNav. */
export function HeroWordmark({ presentation = 'hero' }: HeroWordmarkProps) {
  const branding = useBranding();
  const label = branding.displayName || branding.wordmark;
  const className =
    presentation === 'catalog'
      ? 'wordmark-hero wordmark-hero--catalog'
      : 'wordmark-hero';

  return (
    <p
      className={className}
      data-testid="hero-wordmark"
      data-branding-source={branding.source}
      data-presentation={presentation}
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
