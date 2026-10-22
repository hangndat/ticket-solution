import { t, type CopyKey } from '../copy';
import type { MarketingSectionProps } from './types';

const TRUST_ROWS: Array<{ title: CopyKey; body: CopyKey; icon: string }> = [
  { title: 'trust.p1.title', body: 'trust.p1.body', icon: '⬡' },
  { title: 'trust.p2.title', body: 'trust.p2.body', icon: '✓' },
  { title: 'trust.p3.title', body: 'trust.p3.body', icon: '◎' },
  { title: 'trust.p4.title', body: 'trust.p4.body', icon: '◷' },
  { title: 'trust.p5.title', body: 'trust.p5.body', icon: '🔒' },
];

export function TrustSection({ locale }: MarketingSectionProps) {
  const top = TRUST_ROWS.slice(0, 3);
  const bottom = TRUST_ROWS.slice(3);

  return (
    <section
      id="trust"
      className="mkt-section mkt-section--ink"
      aria-labelledby="trust-title"
      data-analytics-section="trust"
    >
      <div className="mkt-wrap">
        <h2 id="trust-title" className="mkt-display mkt-h2">
          {t(locale, 'trust.title')}
        </h2>
        <p className="mkt-lead">{t(locale, 'trust.lead')}</p>
        <div className="mkt-trust-grid">
          {top.map((row) => (
            <article className="mkt-trust-card" key={row.title}>
              <div className="mkt-trust-icon" aria-hidden="true">{row.icon}</div>
              <h3>{t(locale, row.title)}</h3>
              <p>{t(locale, row.body)}</p>
            </article>
          ))}
        </div>
        <div className="mkt-trust-row-2">
          {bottom.map((row) => (
            <article className="mkt-trust-card" key={row.title}>
              <div className="mkt-trust-icon" aria-hidden="true">{row.icon}</div>
              <h3>{t(locale, row.title)}</h3>
              <p>{t(locale, row.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
