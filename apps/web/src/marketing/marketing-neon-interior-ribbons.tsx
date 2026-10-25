/** Thick neon ribbons between interior sections (decorative; behind section content). */
export function MarketingNeonInteriorRibbons() {
  return (
    <div
      className="mkt-neon-interior-ribbons pointer-events-none absolute inset-0 z-[1] overflow-hidden motion-reduce:opacity-85"
      aria-hidden="true"
      data-testid="marketing-neon-interior-ribbons"
    >
      <span className="mkt-neon-interior-ribbon mkt-neon-interior-ribbon-a" />
      <span className="mkt-neon-interior-ribbon mkt-neon-interior-ribbon-b" />
      <span className="mkt-neon-interior-ribbon mkt-neon-interior-ribbon-c" />
    </div>
  );
}
