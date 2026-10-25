/**
 * Marketing sales header lockup — gradient ribbon V + Vemoki wordmark (neon v1).
 * Scoped styles in marketing-neon.css; not used for product/tenant BrandMark.
 */
export function MarketingNeonLogo() {
  return (
    <span className="mkt-neon-wordmark" aria-hidden="true">
      <svg
        className="mkt-neon-wordmark-mark"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 44 44"
        fill="none"
        role="img"
        focusable="false"
      >
        <title>Vemoki</title>
        <defs>
          <linearGradient
            id="mkt-neon-logo-ribbon-left"
            x1="6"
            y1="4"
            x2="24"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#F23CB3" />
            <stop offset="0.45" stopColor="#9B4DFF" />
            <stop offset="1" stopColor="#397DFF" />
          </linearGradient>
          <linearGradient
            id="mkt-neon-logo-ribbon-right"
            x1="38"
            y1="4"
            x2="20"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FF835F" />
            <stop offset="0.4" stopColor="#FF68AA" />
            <stop offset="1" stopColor="#C870FF" />
          </linearGradient>
        </defs>
        <path
          d="M12 5.5C9 21 10 33 21.5 39.5"
          stroke="url(#mkt-neon-logo-ribbon-left)"
          strokeWidth="8.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M32 5.5C35 21 34 33 22.5 39.5"
          stroke="url(#mkt-neon-logo-ribbon-right)"
          strokeWidth="8.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="mkt-neon-wordmark-text">Vemoki</span>
    </span>
  );
}
