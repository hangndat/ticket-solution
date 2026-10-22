import { Button } from '@ticket/ui';
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
          <p className="mt-4">
            <Button asChild variant="primary" data-analytics-cta="repeat_demo">
              <a href={demo}>{t(locale, 'demo.cta')}</a>
            </Button>
          </p>
        </div>
      </section>

      <section
        id="interest"
        className="mkt-section mkt-section--interest"
        aria-labelledby="interest-title"
        data-analytics-section="conversion"
      >
        <div className="mkt-wrap mkt-interest-grid">
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
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" data-analytics-cta="repeat_demo">
              <a href={demo}>{t(locale, 'cta.repeat.demo')}</a>
            </Button>
            <Button
              asChild
              variant="secondary"
              data-testid="cta-interest"
              data-analytics-cta="repeat_interest"
            >
              <Link href={`${salesHref(locale)}#interest`}>{t(locale, 'cta.repeat.interest')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
