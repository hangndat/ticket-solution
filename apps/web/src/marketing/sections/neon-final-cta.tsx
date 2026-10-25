import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@ticket/ui';
import { t } from '../copy';
import { NEON_MARKETING_ASSETS } from '../neon-assets';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function NeonFinalCtaSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="contact"
      className="mkt-neon-final-cta"
      aria-labelledby="neon-contact-title"
      data-analytics-section="final_cta"
      data-testid="marketing-neon-final-cta"
    >
      <div className="mkt-neon-final-bleed">
        <Image
          src={NEON_MARKETING_ASSETS.finalCtaCrowd}
          alt=""
          fill
          sizes="100vw"
          className="mkt-neon-final-crowd-img"
          priority={false}
        />
        <div className="mkt-neon-final-scrim" aria-hidden="true" />
        <div className={`${marketingWrap} mkt-neon-final-stage`}>
          <div className="mkt-neon-cta-content">
            <p className="mkt-neon-eyebrow">{t(locale, 'neon.final.eyebrow')}</p>
            <h2 id="neon-contact-title" className="mkt-neon-h2">
              {t(locale, 'neon.final.title.line1')}
              <br />
              <span className="mkt-neon-grad">{t(locale, 'neon.final.title.emphasis')}</span>
            </h2>
            <p className="mkt-neon-final-lead">{t(locale, 'neon.final.sub')}</p>
            <div className="mkt-neon-hero-actions mkt-neon-final-actions">
              <Button
                asChild
                variant="primary"
                className="mkt-neon-btn-primary"
                data-testid="cta-demo-final"
                data-analytics-cta="final_demo"
              >
                <a href={demo}>
                  {t(locale, 'hero.cta.demo')}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </Button>
              <Link
                href="#interest"
                className="mkt-neon-btn-secondary mkt-neon-btn-on-photo"
                data-testid="cta-interest-final"
                data-analytics-cta="final_interest"
              >
                {t(locale, 'hero.cta.interest')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
