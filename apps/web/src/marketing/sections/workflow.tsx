import { StepsTimeline } from '@ticket/ui';
import { t } from '../copy';
import type { MarketingSectionProps } from './types';

const STEP_VARIANTS = [1, 2, 3, 4, 5] as const;

export function WorkflowSection({ locale }: MarketingSectionProps) {
  const steps = STEP_VARIANTS.map((visualVariant, index) => ({
    id: `workflow-${index + 1}`,
    label: t(locale, `workflow.step${index + 1}` as 'workflow.step1'),
    visualVariant,
  }));

  return (
    <section
      id="how_it_works"
      className="mkt-section mkt-section--paper-alt"
      aria-labelledby="workflow-title"
      data-analytics-section="how_it_works"
    >
      <div className="mkt-wrap">
        <h2 id="workflow-title" className="mkt-display mkt-h2">
          {t(locale, 'workflow.title')}
        </h2>
        <p className="mkt-lead">{t(locale, 'workflow.lead')}</p>
        <StepsTimeline steps={steps} />
        <p className="mkt-how-note">{t(locale, 'workflow.note')}</p>
      </div>
    </section>
  );
}
