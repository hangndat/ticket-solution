import { cn } from '../../../lib/utils';
import { t } from '../copy';
import { MarketingNeonPrimaryButton } from '../marketing-neon-primary-button';
import { InterestFormIsland } from '../interest-form-island';
import {
  marketingH2,
  marketingInterestGrid,
  marketingInterestH2,
  marketingLead,
  marketingSection,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function CtaSection({ locale, demo }: MarketingSectionProps) {
  return (
    <>
      <section
        id="demo"
        className={marketingSection('paperAlt')}
        aria-labelledby="demo-title"
        data-analytics-section="demo"
      >
        <div className={marketingWrap}>
          <h2 id="demo-title" className={marketingH2}>
            {t(locale, 'demo.title')}
          </h2>
          <p className={marketingLead}>{t(locale, 'demo.lead')}</p>
          <p className="mt-4">
            <MarketingNeonPrimaryButton asChild data-analytics-cta="repeat_demo">
              <a href={demo}>{t(locale, 'demo.cta')}</a>
            </MarketingNeonPrimaryButton>
          </p>
        </div>
      </section>

      <section
        id="interest"
        className={cn(marketingSection('interest'), 'mkt-lead-section')}
        aria-labelledby="interest-title"
        data-analytics-section="conversion"
      >
        <div className={`${marketingWrap} ${marketingInterestGrid}`}>
          <div>
            <h2 id="interest-title" className={marketingInterestH2}>
              {t(locale, 'interest.title')}
            </h2>
            <p className={marketingLead}>{t(locale, 'interest.lead')}</p>
          </div>
          <InterestFormIsland locale={locale} demo={demo} />
        </div>
      </section>
    </>
  );
}
