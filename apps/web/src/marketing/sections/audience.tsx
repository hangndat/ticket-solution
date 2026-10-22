import { t, type CopyKey } from '../copy';
import {
  marketingAudienceCard,
  marketingAudienceGrid,
  marketingAudienceIcon,
  marketingH2,
  marketingLead,
  marketingRow,
  marketingSection,
  marketingStack,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

type AudienceKey = 'owner' | 'agency' | 'staff' | 'guest';

const AUDIENCE_CARDS: Array<{
  key: AudienceKey;
  emphasis: boolean;
  icon: string;
}> = [
  { key: 'owner', emphasis: true, icon: '🏢' },
  { key: 'agency', emphasis: true, icon: '👥' },
  { key: 'staff', emphasis: false, icon: '📷' },
  { key: 'guest', emphasis: false, icon: '🎫' },
];

export function AudienceSection({ locale }: MarketingSectionProps) {
  return (
    <>
      <section
        id="solutions"
        className={marketingSection('paper')}
        aria-labelledby="audience-title"
        data-analytics-section="solutions"
      >
        <div className={marketingWrap}>
          <h2 id="audience-title" className={marketingH2}>
            {t(locale, 'audience.title')}
          </h2>
          <p className={marketingLead}>{t(locale, 'audience.lead')}</p>
          <div className={marketingAudienceGrid}>
            {AUDIENCE_CARDS.map((card) => (
              <article
                key={card.key}
                className={marketingAudienceCard(card.emphasis)}
              >
                <span className={marketingAudienceIcon} aria-hidden="true">{card.icon}</span>
                <h3>
                  {t(locale, `audience.${card.key}.title` as CopyKey)}
                </h3>
                <p>{t(locale, `audience.${card.key}.body` as CopyKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="whitelabel"
        className={marketingSection('paperAlt')}
        aria-labelledby="wl-title"
      >
        <div className={marketingWrap}>
          <h2 id="wl-title" className={marketingH2}>
            {t(locale, 'whitelabel.title')}
          </h2>
          <p className={marketingLead}>{t(locale, 'whitelabel.lead')}</p>
          <div className={marketingStack}>
            <div className={marketingRow}>
              <h3>{t(locale, 'whitelabel.point1')}</h3>
              <p>{t(locale, 'whitelabel.point1.body')}</p>
            </div>
            <div className={marketingRow}>
              <h3>{t(locale, 'whitelabel.point2')}</h3>
              <p>{t(locale, 'whitelabel.point2.body')}</p>
            </div>
            <div className={marketingRow}>
              <h3>{t(locale, 'whitelabel.point3')}</h3>
              <p>{t(locale, 'whitelabel.point3.body')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
