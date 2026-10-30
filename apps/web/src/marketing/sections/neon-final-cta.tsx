import Image from 'next/image';
import { t } from '../copy';
import { InterestCtaLink } from '../interest-cta-link';
import { MarketingNeonPrimaryButton } from '../marketing-neon-primary-button';
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
      <div className="mkt-neon-final-mobile-card" aria-hidden="true">
        <span className="mkt-neon-final-ripple mkt-neon-final-ripple-a" />
        <span className="mkt-neon-final-ripple mkt-neon-final-ripple-b" />
        <span className="mkt-neon-final-ripple mkt-neon-final-ripple-c" />
      </div>
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
        <p className="mkt-neon-final-script" aria-hidden="true">
          <span>{t(locale, 'neon.final.script.line1')}</span>
          <span>{t(locale, 'neon.final.script.line2')}</span>
        </p>
        <div className={`${marketingWrap} mkt-neon-final-stage`}>
          <div className="mkt-neon-cta-content mkt-neon-final-mobile-inner">
            <p className="mkt-neon-eyebrow">{t(locale, 'neon.final.eyebrow')}</p>
            <h2 id="neon-contact-title" className="mkt-neon-h2">
              {t(locale, 'neon.final.title.line1')}
              <br />
              <span className="mkt-neon-grad">{t(locale, 'neon.final.title.emphasis')}</span>
            </h2>
            <p className="mkt-neon-final-lead">{t(locale, 'neon.final.sub')}</p>
            <div className="mkt-neon-hero-actions mkt-neon-final-actions">
              <MarketingNeonPrimaryButton
                asChild
                data-testid="cta-demo-final"
                data-analytics-cta="final_demo"
              >
                <a href={demo}>
                  {t(locale, 'hero.cta.demo')}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </MarketingNeonPrimaryButton>
              <InterestCtaLink
                href="#interest"
                className="mkt-neon-btn-secondary mkt-neon-btn-on-photo"
                data-testid="cta-interest-final"
                data-analytics-cta="final_interest"
              >
                {t(locale, 'hero.cta.interest')}
              </InterestCtaLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
