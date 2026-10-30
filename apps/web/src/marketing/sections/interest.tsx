import { cn } from '../../../lib/utils';
import { t } from '../copy';
import { InterestFormIsland } from '../interest-form-island';
import {
  marketingInterestGrid,
  marketingInterestH2,
  marketingLead,
  marketingSection,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function InterestSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="interest"
      className={cn(marketingSection('interest'), 'mkt-lead-section mkt-neon-interest')}
      aria-labelledby="interest-title"
      data-analytics-section="conversion"
      data-testid="marketing-interest"
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
  );
}
