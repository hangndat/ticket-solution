import Link from 'next/link';
import { t } from '../copy';
import { InterestFormIsland } from '../interest-form-island';
import { salesHref } from '../links';
import type { MarketingSectionProps } from './types';

export function CtaSection({ locale, demo }: MarketingSectionProps) {
  return (
    <>
      <section
        id="demo"
        className="mkt-section mkt-section--paper-alt"
        aria-labelledby="demo-title"
        data-analytics-section="demo"
      >
        <div className="mkt-wrap">
          <h2 id="demo-title" className="mkt-display mkt-h2">
            {t(locale, 'demo.title')}
          </h2>
          <p className="mkt-lead">{t(locale, 'demo.lead')}</p>
          <div className="mkt-demo-banner" role="status">
            {t(locale, 'demo.banner')}
          </div>
          <p className="mkt-demo-cta">
            <a
              className="mkt-btn mkt-btn--primary"
              href={demo}
              data-analytics-cta="repeat_demo"
            >
              {t(locale, 'demo.cta')}
            </a>
          </p>
        </div>
      </section>

      <section
        id="interest"
        className="mkt-section mkt-section--cta"
        aria-labelledby="interest-title"
        data-analytics-section="conversion"
      >
        <div className="mkt-wrap mkt-cta-grid">
          <div>
            <h2 id="interest-title" className="mkt-display mkt-h2">
              {t(locale, 'interest.title')}
            </h2>
            <p className="mkt-lead">{t(locale, 'interest.lead')}</p>
          </div>
          <InterestFormIsland locale={locale} />
        </div>
      </section>

      <section
        className="mkt-section mkt-section--paper"
        aria-labelledby="cta-repeat-title"
      >
        <div className="mkt-wrap">
          <h2 id="cta-repeat-title" className="mkt-display mkt-h2">
            {t(locale, 'cta.repeat.title')}
          </h2>
          <div className="mkt-hero-cta">
            <a
              className="mkt-btn mkt-btn--primary"
              href={demo}
              data-analytics-cta="repeat_demo"
            >
              {t(locale, 'cta.repeat.demo')}
            </a>
            <Link
              className="mkt-btn mkt-btn--secondary"
              href={`${salesHref(locale)}#interest`}
              data-testid="cta-interest"
              data-analytics-cta="repeat_interest"
            >
              {t(locale, 'cta.repeat.interest')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
