import Link from 'next/link';
import { t } from '../copy';
import { InterestFormIsland } from '../interest-form-island';
import { salesHref } from '../links';
import type { MarketingSectionProps } from './types';

export function CtaSection({ locale, demo }: MarketingSectionProps) {
  return (
    <>
      <section id="demo" aria-labelledby="demo-title" data-analytics-section="demo">
        <h2 id="demo-title">{t(locale, 'demo.title')}</h2>
        <p className="mkt-lead">{t(locale, 'demo.lead')}</p>
        <div className="mkt-demo-banner" role="status">
          {t(locale, 'demo.banner')}
        </div>
        <p className="mkt-demo-cta">
          <a
            className="mkt-btn mkt-btn-primary"
            href={demo}
            data-analytics-cta="repeat_demo"
          >
            {t(locale, 'demo.cta')}
          </a>
        </p>
      </section>

      <section
        id="interest"
        aria-labelledby="interest-title"
        data-analytics-section="conversion"
      >
        <h2 id="interest-title">{t(locale, 'interest.title')}</h2>
        <p className="mkt-lead">{t(locale, 'interest.lead')}</p>
        <InterestFormIsland locale={locale} />
      </section>

      <section aria-labelledby="cta-repeat-title">
        <h2 id="cta-repeat-title">{t(locale, 'cta.repeat.title')}</h2>
        <div className="mkt-cta-row">
          <a
            className="mkt-btn mkt-btn-primary"
            href={demo}
            data-analytics-cta="repeat_demo"
          >
            {t(locale, 'cta.repeat.demo')}
          </a>
          <Link
            className="mkt-btn mkt-btn-primary"
            href={`${salesHref(locale)}#interest`}
            data-testid="cta-interest"
            data-analytics-cta="repeat_interest"
          >
            {t(locale, 'cta.repeat.interest')}
          </Link>
        </div>
      </section>
    </>
  );
}
