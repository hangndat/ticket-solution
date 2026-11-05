'use client';

import { attendeeBrandMarkImg } from './attendee-surface';
import { useBranding } from './branding';

/** Tenant logo when configured; otherwise the Vemoki Logo Kit mark. */
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
    // eslint-disable-next-line @next/next/no-img-element -- bundled Logo Kit asset needs no image optimization
    <img
      className={attendeeBrandMarkImg}
      src="/brand/electric-violet/mark.svg"
      alt=""
      width={64}
      height={64}
      data-testid="brand-mark-img"
    />
  );
}

/** Approved outlined platform lockup; tenant wordmarks keep their configured text path. */
export function PlatformLockup({
  tone = 'color',
  className,
}: {
  tone?: 'color' | 'white';
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public approved SVG has no external dependencies
    <img
      src={`/brand/electric-violet/lockup${tone === 'white' ? '-white' : ''}.svg`}
      alt=""
      width={184}
      height={43}
      className={className}
      data-testid="platform-lockup"
    />
  );
}
