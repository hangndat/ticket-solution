import Image from 'next/image';
import { t } from '../copy';
import { MarketingNeonPrimaryButton } from '../marketing-neon-primary-button';
import { NEON_MARKETING_ASSETS } from '../neon-assets';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

const FEATURE_KEYS = [
  { key: 'neon.product.f1', icon: 'p1', glyph: '▣' },
  { key: 'neon.product.f2', icon: 'p2', glyph: '✉' },
  { key: 'neon.product.f3', icon: 'p3', glyph: '▦' },
  { key: 'neon.product.f4', icon: 'p4', glyph: '▥' },
] as const;

export function NeonProductSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="product"
      className="mkt-neon-block mkt-neon-product"
      aria-labelledby="neon-product-title"
      data-analytics-section="product"
      data-testid="marketing-neon-product"
    >
      <div className={`${marketingWrap} mkt-neon-product-grid`}>
        <div className="mkt-neon-product-copy">
          <p className="mkt-neon-eyebrow">{t(locale, 'neon.product.eyebrow')}</p>
          <h2 id="neon-product-title" className="mkt-neon-h2">
            {t(locale, 'neon.product.title.lead')}{' '}
            <span className="mkt-neon-grad">{t(locale, 'neon.product.title.emphasis')}</span>
          </h2>
          <ul className="mkt-neon-feature-list">
            {FEATURE_KEYS.map((f) => (
              <li key={f.key}>
                <span className={`mkt-neon-feature-icon ${f.icon}`} aria-hidden="true">
                  {f.glyph}
                </span>
                {t(locale, f.key)}
              </li>
            ))}
          </ul>
          <MarketingNeonPrimaryButton
            asChild
            className="mkt-neon-product-cta max-md:w-full"
            data-analytics-cta="product_demo"
          >
            <a href={demo}>
              {t(locale, 'neon.product.cta')}
              <span aria-hidden="true"> ↗</span>
            </a>
          </MarketingNeonPrimaryButton>
        </div>
        <div className="mkt-neon-product-image">
          <span className="mkt-neon-product-halo" aria-hidden="true" />
          <Image
            src={NEON_MARKETING_ASSETS.product}
            alt={t(locale, 'neon.product.image.alt')}
            width={900}
            height={620}
            sizes="(max-width: 640px) 100vw, 57vw"
            className="mkt-neon-product-img"
          />
          <p className="mkt-neon-demo-label">{t(locale, 'neon.product.image.caption')}</p>
        </div>
      </div>
    </section>
  );
}
