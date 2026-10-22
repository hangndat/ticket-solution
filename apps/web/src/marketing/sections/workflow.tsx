import { t } from '../copy';
import type { MarketingSectionProps } from './types';

export function WorkflowSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="how_it_works"
      aria-labelledby="workflow-title"
      data-analytics-section="how_it_works"
    >
      <h2 id="workflow-title">{t(locale, 'workflow.title')}</h2>
      <p className="mkt-lead">{t(locale, 'workflow.lead')}</p>
      <ol className="mkt-steps">
        <li>{t(locale, 'workflow.step1')}</li>
        <li>{t(locale, 'workflow.step2')}</li>
        <li>{t(locale, 'workflow.step3')}</li>
        <li>{t(locale, 'workflow.step4')}</li>
        <li>{t(locale, 'workflow.step5')}</li>
      </ol>
      <p className="mkt-lead mkt-lead-follow">{t(locale, 'workflow.note')}</p>
    </section>
  );
}
