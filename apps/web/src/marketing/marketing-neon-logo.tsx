/**
 * Marketing sales header lockup — gradient ribbon V + Vemoki wordmark (neon v1).
 * Scoped styles in marketing-neon.css; not used for product/tenant BrandMark.
 *
 * Icon: two filled ribbon arms (not stroked outlines) — capsule tops, overlap at base.
 */
export function MarketingNeonLogo() {
  return (
    <span className="mkt-neon-wordmark" aria-hidden="true">
      <svg
        className="mkt-neon-wordmark-mark"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 44 44"
        fill="none"
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="mkt-neon-logo-ribbon-left"
            x1="5"
            y1="3"
            x2="23"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#F23CB3" />
            <stop offset="0.42" stopColor="#B04AFF" />
            <stop offset="0.78" stopColor="#6B5CFF" />
            <stop offset="1" stopColor="#3A7DFF" />
          </linearGradient>
          <linearGradient
            id="mkt-neon-logo-ribbon-right"
            x1="39"
            y1="3"
            x2="21"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FF835F" />
            <stop offset="0.38" stopColor="#FF6BA8" />
            <stop offset="0.72" stopColor="#C96EFF" />
            <stop offset="1" stopColor="#4B6FFF" />
          </linearGradient>
        </defs>
        {/* Left ribbon — filled arm with semicircular capsule top */}
        <path
          fill="url(#mkt-neon-logo-ribbon-left)"
          d="M 2.15 10.35
             A 5.85 5.85 0 0 1 7.35 3.15
             A 5.85 5.85 0 0 1 15.25 5.55
             C 17.55 9.85 19.85 25.8 21.45 35.85
             C 21.95 38.55 22.3 40.35 22.55 41.05
             C 19.75 37.65 14.35 27.35 10.55 17.85
             C 7.55 10.85 4.55 9.35 2.15 10.35
             Z"
        />
        {/* Right ribbon — above left; overlap at bottom center */}
        <path
          fill="url(#mkt-neon-logo-ribbon-right)"
          d="M 41.85 10.35
             A 5.85 5.85 0 0 0 36.65 3.15
             A 5.85 5.85 0 0 0 28.75 5.55
             C 26.45 9.85 24.15 25.8 22.55 35.85
             C 22.05 38.55 21.7 40.35 21.45 41.05
             C 24.25 37.65 29.65 27.35 33.45 17.85
             C 36.45 10.85 39.45 9.35 41.85 10.35
             Z"
        />
      </svg>
      <span className="mkt-neon-wordmark-text">Vemoki</span>
    </span>
  );
}
