import { t, type CopyKey } from '../copy';
import {
  marketingH2,
  marketingLead,
  marketingSection,
  marketingTrustCard,
  marketingTrustGrid,
  marketingTrustIcon,
  marketingTrustRow2,
  marketingWrap,
} from '../marketing-surface';
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
      className={marketingSection('ink')}
      aria-labelledby="trust-title"
      data-analytics-section="trust"
      data-on-ink=""
    >
      <div className={marketingWrap}>
        <h2 id="trust-title" className={marketingH2}>
          {t(locale, 'trust.title')}
        </h2>
        <p className={marketingLead}>{t(locale, 'trust.lead')}</p>
        <div className={marketingTrustGrid}>
          {top.map((row) => (
            <article className={marketingTrustCard} key={row.title}>
              <div className={marketingTrustIcon} aria-hidden="true">{row.icon}</div>
              <h3>{t(locale, row.title)}</h3>
              <p>{t(locale, row.body)}</p>
            </article>
          ))}
        </div>
        <div className={marketingTrustRow2}>
          {bottom.map((row) => (
            <article className={marketingTrustCard} key={row.title}>
              <div className={marketingTrustIcon} aria-hidden="true">{row.icon}</div>
              <h3>{t(locale, row.title)}</h3>
              <p>{t(locale, row.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
