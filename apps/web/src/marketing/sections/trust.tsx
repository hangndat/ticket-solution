import { t, type CopyKey } from '../copy';
import type { MarketingSectionProps } from './types';

const TRUST_ROWS: Array<{ title: CopyKey; body: CopyKey }> = [
  { title: 'trust.p1.title', body: 'trust.p1.body' },
  { title: 'trust.p2.title', body: 'trust.p2.body' },
  { title: 'trust.p3.title', body: 'trust.p3.body' },
  { title: 'trust.p4.title', body: 'trust.p4.body' },
  { title: 'trust.p5.title', body: 'trust.p5.body' },
];

export function TrustSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      data-analytics-section="trust"
    >
      <h2 id="trust-title">{t(locale, 'trust.title')}</h2>
      <p className="mkt-lead">{t(locale, 'trust.lead')}</p>
      <div className="mkt-stack">
        {TRUST_ROWS.map((row) => (
          <div className="mkt-row" key={row.title}>
            <h3>{t(locale, row.title)}</h3>
            <p>{t(locale, row.body)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
