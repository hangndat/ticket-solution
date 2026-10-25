/** Decorative hero layers — no information content; disabled when prefers-reduced-motion. */
export function MarketingHeroDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible max-md:overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      <div className="mkt-hero-glow mkt-hero-glow-a" />
      <div className="mkt-hero-glow mkt-hero-glow-b" />
      <div className="mkt-hero-orbit mkt-hero-orbit-b" />
    </div>
  );
}
