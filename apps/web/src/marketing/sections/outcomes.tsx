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
      aria-labelledby="outcomes-title"
      data-analytics-section="outcomes"
    >
      <h2 id="outcomes-title">{t(locale, 'outcomes.title')}</h2>
      <p className="mkt-outcomes-disclaimer" role="status">
        {t(locale, 'outcomes.disclaimer')}
      </p>
      <p className="mkt-lead">{t(locale, 'outcomes.lead')}</p>
      <div className="mkt-outcomes-metrics">
        {OUTCOME_METRIC_IDS.map((id) => (
          <div className="mkt-outcome-metric" key={id}>
            <p className="mkt-outcome-label">{t(locale, metricKey(id, 'label'))}</p>
            <p className="mkt-outcome-value">{t(locale, metricKey(id, 'value'))}</p>
          </div>
        ))}
      </div>
      <div className="mkt-outcomes-chart" aria-hidden="true">
        {OUTCOME_CHART_BARS.map((height, index) => (
          <span
            key={index}
            className="mkt-outcomes-chart-bar"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <p className="mkt-outcomes-chart-caption">
        {t(locale, 'outcomes.chart.caption')}
      </p>
      <p className="mkt-demo-cta">
        <a className="mkt-btn mkt-btn-secondary" href={demo}>
          {t(locale, 'demo.cta')}
        </a>
        <span className="mkt-outcomes-demo-note">{t(locale, 'badge.demo')}</span>
      </p>
    </section>
  );
}
