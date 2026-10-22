import { Button, DemoMetric } from '@ticket/ui';
import {
  OUTCOME_CHART_BARS,
  OUTCOME_METRIC_IDS,
  type OutcomeMetricId,
} from '../content-config';
import { t } from '../copy';
import {
  marketingChart,
  marketingChartBars,
  marketingChartCaption,
  marketingDemoBannerInk,
  marketingH2,
  marketingLead,
  marketingMetrics,
  marketingOutcomesDemoNote,
  marketingSection,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

function metricKey(id: OutcomeMetricId, part: 'label' | 'value') {
  return `outcomes.${id}.${part}` as const;
}

export function OutcomesSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="outcomes"
      className={marketingSection('ink')}
      aria-labelledby="outcomes-title"
      data-analytics-section="outcomes"
      data-on-ink=""
    >
      <div className={marketingWrap}>
        <div className={marketingDemoBannerInk} role="status">
          {t(locale, 'outcomes.disclaimer')}
        </div>
        <h2 id="outcomes-title" className={marketingH2}>
          {t(locale, 'outcomes.title')}
        </h2>
        <p className={marketingLead}>{t(locale, 'outcomes.lead')}</p>
        <div className={marketingMetrics}>
          {OUTCOME_METRIC_IDS.map((id) => (
            <DemoMetric
              key={id}
              label={t(locale, metricKey(id, 'label'))}
              value={t(locale, metricKey(id, 'value'))}
            />
          ))}
        </div>
        <div className={marketingChart} aria-hidden="true">
          <div className={marketingChartBars}>
            {OUTCOME_CHART_BARS.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className={marketingChartCaption}>{t(locale, 'outcomes.chart.caption')}</p>
        </div>
        <p className="mt-4">
          <Button asChild variant="secondaryOnInk">
            <a href={demo}>{t(locale, 'demo.cta')}</a>
          </Button>
          <span className={marketingOutcomesDemoNote}>{t(locale, 'badge.demo')}</span>
        </p>
      </div>
    </section>
  );
}
