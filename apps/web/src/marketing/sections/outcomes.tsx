import { DemoMetric } from '@ticket/ui';
import {
  OUTCOME_CHART_BARS,
  OUTCOME_METRIC_IDS,
  type OutcomeMetricId,
} from '../content-config';
import { t } from '../copy';
import type { MarketingSectionProps } from './types';

function metricKey(id: OutcomeMetricId, part: 'label' | 'value') {
  return `outcomes.${id}.${part}` as const;
}

export function OutcomesSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section
      id="outcomes"
      className="mkt-section mkt-section--ink"
      aria-labelledby="outcomes-title"
      data-analytics-section="outcomes"
    >
      <div className="mkt-wrap">
        <div className="mkt-demo-banner" role="status">
          {t(locale, 'outcomes.disclaimer')}
        </div>
        <h2 id="outcomes-title" className="mkt-display mkt-h2">
          {t(locale, 'outcomes.title')}
        </h2>
        <p className="mkt-lead">{t(locale, 'outcomes.lead')}</p>
        <div className="mkt-metrics">
          {OUTCOME_METRIC_IDS.map((id) => (
            <DemoMetric
              key={id}
              label={t(locale, metricKey(id, 'label'))}
              value={t(locale, metricKey(id, 'value'))}
            />
          ))}
        </div>
        <div className="mkt-chart" aria-hidden="true">
          <div className="mkt-chart-bars">
            {OUTCOME_CHART_BARS.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className="mkt-chart-caption">{t(locale, 'outcomes.chart.caption')}</p>
        </div>
        <p className="mkt-demo-cta">
          <a className="mkt-btn mkt-btn--secondary" href={demo}>
            {t(locale, 'demo.cta')}
          </a>
          <span className="mkt-outcomes-demo-note">{t(locale, 'badge.demo')}</span>
        </p>
      </div>
    </section>
  );
}
