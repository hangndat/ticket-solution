import { t, type CopyKey } from '../copy';
import type { MarketingSectionProps } from './types';

type AudienceKey = 'owner' | 'agency' | 'staff' | 'guest';

const AUDIENCE_CARDS: Array<{
  key: AudienceKey;
  emphasis: boolean;
  icon: string;
}> = [
  {
    key: 'owner',
    emphasis: true,
    icon: '🏢',
  },
  {
    key: 'agency' as const,
    emphasis: true,
    icon: '👥',
  },
  {
    key: 'staff' as const,
    emphasis: false,
    icon: '📷',
  },
  {
    key: 'guest' as const,
    emphasis: false,
    icon: '🎫',
  },
];

export function AudienceSection({ locale }: MarketingSectionProps) {
  return (
    <>
      <section
        id="solutions"
        className="mkt-section mkt-section--paper"
        aria-labelledby="audience-title"
        data-analytics-section="solutions"
      >
        <div className="mkt-wrap">
          <h2 id="audience-title" className="mkt-display mkt-h2">
            {t(locale, 'audience.title')}
          </h2>
          <p className="mkt-lead">{t(locale, 'audience.lead')}</p>
          <div className="mkt-audience-grid">
            {AUDIENCE_CARDS.map((card) => (
              <article
                key={card.key}
                className={`mkt-audience-card${
                  card.emphasis
                    ? ' mkt-audience-card--emphasis'
                    : ' mkt-audience-card--muted'
                }`}
              >
                <span className="mkt-audience-icon" aria-hidden="true">{card.icon}</span>
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
        className="mkt-section mkt-section--paper-alt"
        aria-labelledby="wl-title"
      >
        <div className="mkt-wrap">
          <h2 id="wl-title" className="mkt-display mkt-h2">
            {t(locale, 'whitelabel.title')}
          </h2>
          <p className="mkt-lead">{t(locale, 'whitelabel.lead')}</p>
          <div className="mkt-stack">
            <div className="mkt-row">
              <h3>{t(locale, 'whitelabel.point1')}</h3>
              <p>{t(locale, 'whitelabel.point1.body')}</p>
            </div>
            <div className="mkt-row">
              <h3>{t(locale, 'whitelabel.point2')}</h3>
              <p>{t(locale, 'whitelabel.point2.body')}</p>
            </div>
            <div className="mkt-row">
              <h3>{t(locale, 'whitelabel.point3')}</h3>
              <p>{t(locale, 'whitelabel.point3.body')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
