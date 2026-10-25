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
      viewBox="0 0 72 77"
      aria-hidden="true"
      data-testid="brand-mark-svg"
    >
      <defs>
        <linearGradient
          id="vemoki-mark-a"
          x1="25"
          y1="28"
          x2="43"
          y2="61"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EF71ED" />
          <stop offset="0.37" stopColor="#D56AF8" />
          <stop offset="0.7" stopColor="#6362F1" />
          <stop offset="1" stopColor="#7265F2" />
        </linearGradient>
        <linearGradient
          id="vemoki-mark-b"
          x1="56"
          y1="28"
          x2="43"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFAE58" />
          <stop offset="0.22" stopColor="#F97867" />
          <stop offset="0.65" stopColor="#E85191" />
          <stop offset="1" stopColor="#9562E7" />
        </linearGradient>
      </defs>
      <path
        d="M52.5 27.3C58.9 26.3 62.8 30.2 60.1 36.2L47.9 59.3C46 62.7 42.5 63.8 39.1 62C35.8 60.3 34.5 56.8 36.3 53.4L47.4 31.2C48.6 28.9 50.3 27.7 52.5 27.3Z"
        fill="url(#vemoki-mark-b)"
      />
      <path
        d="M26.9 27.3C30.2 27.1 32.9 28.7 34.8 32L47.8 53.7C49.7 57.2 48 61.4 44.6 63C40.7 64.8 36.6 62.6 34.4 58.6L21.3 36.2C18.2 30.7 21.7 27.6 26.9 27.3Z"
        fill="url(#vemoki-mark-a)"
      />
      <circle cx="62" cy="18" r="4.2" fill="var(--signal, #E11D48)" />
    </svg>
  );
}
