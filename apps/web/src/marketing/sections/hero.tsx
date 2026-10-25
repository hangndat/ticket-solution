import { Button } from '@ticket/ui';
import Image from 'next/image';
import Link from 'next/link';
import { t } from '../copy';
import { MarketingHeroDecor } from '../marketing-hero-decor';
import { NEON_MARKETING_ASSETS } from '../neon-assets';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

const TRUST_KEYS = ['hero.proof1', 'hero.proof2', 'hero.proof3'] as const;
const TRUST_ICONS = ['✦', '◎', '▥'] as const;

export function HeroSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="top"
      className="mkt-neon-hero"
      aria-labelledby="hero-title"
      data-analytics-section="hero"
      data-on-ink=""
      data-testid="marketing-neon-hero"
    >
      <div className={`${marketingWrap} mkt-neon-hero-grid`}>
        <div className="mkt-neon-hero-copy">
          <p className="mkt-neon-eyebrow">{t(locale, 'hero.eyebrow')}</p>
          <h1 id="hero-title" className="mkt-neon-hero-title" data-testid="hero-headline">
            {t(locale, 'neon.hero.headline.lead')}
            <span className="mkt-neon-grad">{t(locale, 'neon.hero.headline.emphasis')}</span>
            <span className="mkt-neon-period" aria-hidden="true">.</span>
          </h1>
          <p className="mkt-neon-intro">{t(locale, 'hero.sub')}</p>
          <div className="mkt-neon-hero-actions">
            <Button
              asChild
              variant="primary"
              className="mkt-neon-btn-primary"
              data-testid="cta-demo"
              data-analytics-cta="hero_demo"
            >
              <a href={demo}>
                {t(locale, 'hero.cta.demo')}
                <span aria-hidden="true"> ↗</span>
              </a>
            </Button>
            <Link
              href="#interest"
              className="mkt-neon-btn-secondary"
              data-testid="cta-interest"
              data-analytics-cta="hero_interest"
            >
              {t(locale, 'hero.cta.interest')}
            </Link>
          </div>
          <p className="mkt-neon-demo-note" role="status" data-testid="demo-badge">
            {t(locale, 'hero.demo_note')}
          </p>
          <div className="mkt-neon-trust-chips" aria-label={t(locale, 'hero.proofs.label')}>
            {TRUST_KEYS.map((key, i) => (
              <span key={key}>
                <b aria-hidden="true">{TRUST_ICONS[i]}</b>
                {t(locale, key)}
              </span>
            ))}
          </div>
        </div>
        <div
          className="mkt-neon-hero-visual"
          aria-label={t(locale, 'neon.hero.visual.label')}
          role="img"
        >
          <MarketingHeroDecor />
          <Image
            src={NEON_MARKETING_ASSETS.heroFigure}
            alt=""
            width={720}
            height={490}
            priority
            sizes="(max-width: 640px) 108vw, 48vw"
            className="mkt-neon-hero-figure"
          />
        </div>
      </div>
    </section>
  );
}
