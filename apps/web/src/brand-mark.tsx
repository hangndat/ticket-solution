'use client';

import { attendeeBrandMark, attendeeBrandMarkImg } from './attendee-surface';
import { useBranding } from './branding';

/** Vemoki mark — two strokes as V; signal punch = Live Pulse accent (tokens.signal). */
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
    <svg
      className={attendeeBrandMark}
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-testid="brand-mark-svg"
    >
      <g fill="currentColor">
        <rect
          x="25"
          y="8"
          width="14"
          height="48"
          rx="7"
          transform="rotate(-24 32 52)"
        />
        <rect
          x="25"
          y="8"
          width="14"
          height="48"
          rx="7"
          transform="rotate(24 32 52)"
        />
      </g>
      <circle cx="49" cy="14" r="4.2" fill="var(--signal, #E11D48)" />
    </svg>
  );
}
