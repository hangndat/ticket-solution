/**
 * Marketing sales header/footer lockup — user-supplied gradient V mark + Vemoki wordmark (neon v1).
 * Asset: public/marketing/neon/vemoki-v-mark.png (transparent PNG; not product BrandMark).
 */
import Image from 'next/image';

const V_MARK_SRC = '/marketing/neon/vemoki-v-mark.png';
const V_MARK_WIDTH = 128;
const V_MARK_HEIGHT = 121;

export function MarketingNeonLogo() {
  return (
    <span className="mkt-neon-wordmark" aria-hidden="true">
      <Image
        src={V_MARK_SRC}
        alt=""
        width={V_MARK_WIDTH}
        height={V_MARK_HEIGHT}
        className="mkt-neon-wordmark-mark"
        sizes="(min-width: 1440px) 40px, (min-width: 390px) 38px, 34px"
        priority
      />
      <span className="mkt-neon-wordmark-text">Vemoki</span>
    </span>
  );
}
