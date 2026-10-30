import Image from 'next/image';
import { NEON_MARKETING_ASSETS } from './neon-assets';

/** Full-page edge ribbons + spheres (decorative only; behind content). */
export function MarketingNeonEdgeDecor() {
  return (
    <div
      className="mkt-neon-edge-decor pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:opacity-90"
      aria-hidden="true"
      data-testid="marketing-neon-edge-decor"
    >
      <Image
        src={NEON_MARKETING_ASSETS.pageEdgeDecor}
        alt=""
        width={320}
        height={941}
        sizes="min(28vw, 320px)"
        className="mkt-neon-edge-strip mkt-neon-edge-strip-left"
        priority
      />
      <Image
        src={NEON_MARKETING_ASSETS.pageEdgeDecor}
        alt=""
        width={320}
        height={941}
        sizes="min(28vw, 320px)"
        className="mkt-neon-edge-strip mkt-neon-edge-strip-right"
        priority
      />
      <span className="mkt-neon-float-bubble mkt-neon-float-bubble-a" />
      <span className="mkt-neon-float-bubble mkt-neon-float-bubble-b" />
      <span className="mkt-neon-float-bubble mkt-neon-float-bubble-c" />
      <span className="mkt-neon-float-bubble mkt-neon-float-bubble-d" />
    </div>
  );
}
