'use client';

import { attendeeBrandMarkImg } from './attendee-surface';
import { useBranding } from './branding';
import {
  VEMOKI_DEFAULT_MARK_PATH,
  VEMOKI_DEFAULT_MARK_WEBP_PATH,
  VEMOKI_PRODUCT_MARK_HEIGHT,
  VEMOKI_PRODUCT_MARK_WIDTH,
} from './branding/vemoki';

/** Vemoki default mark — approved raster from Logo Kit (not hand-traced SVG). */
export function BrandMark({
  logoUrl: logoUrlProp,
}: {
  /** Override context logo (e.g. tests / forced fixture). */
  logoUrl?: string | null;
} = {}) {
  const branding = useBranding();
  const logoUrl = logoUrlProp !== undefined ? logoUrlProp : branding.logoUrl;

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tenant logo URL is allowlisted https or root-relative
      <img
        className={attendeeBrandMarkImg}
        src={logoUrl}
        alt=""
        width={64}
        height={64}
        data-testid="brand-logo-img"
      />
    );
  }

  return (
    <picture>
      <source srcSet={VEMOKI_DEFAULT_MARK_WEBP_PATH} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element -- product mark is a static raster twin */}
      <img
        className={attendeeBrandMarkImg}
        src={VEMOKI_DEFAULT_MARK_PATH}
        alt=""
        aria-hidden="true"
        width={VEMOKI_PRODUCT_MARK_WIDTH}
        height={VEMOKI_PRODUCT_MARK_HEIGHT}
        data-testid="brand-mark-svg"
      />
    </picture>
  );
}
