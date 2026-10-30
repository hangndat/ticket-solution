import Image from 'next/image';
import { t } from '../copy';
import { NEON_MARKETING_ASSETS } from '../neon-assets';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

const CARD_KEYS = [
  { title: 'neon.events.card1.title', alt: 'neon.events.card1.alt' },
  { title: 'neon.events.card2.title', alt: 'neon.events.card2.alt' },
  { title: 'neon.events.card3.title', alt: 'neon.events.card3.alt' },
  { title: 'neon.events.card4.title', alt: 'neon.events.card4.alt' },
] as const;

export function NeonEventsSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="events"
      className="mkt-neon-block mkt-neon-events"
      aria-labelledby="neon-events-title"
      data-analytics-section="events"
      data-testid="marketing-neon-events"
    >
      <div className={marketingWrap}>
        <p className="mkt-neon-eyebrow">{t(locale, 'neon.events.eyebrow')}</p>
        <div className="mkt-neon-section-heading">
          <h2 id="neon-events-title" className="mkt-neon-h2">
            {t(locale, 'neon.events.title.lead')}{' '}
            <span className="mkt-neon-grad">{t(locale, 'neon.events.title.emphasis')}</span>
          </h2>
          <p>{t(locale, 'neon.events.sub')}</p>
        </div>
        <div className="mkt-neon-event-grid">
          {CARD_KEYS.map((keys, index) => (
            <article key={keys.title} className="mkt-neon-event-card">
              <Image
                src={NEON_MARKETING_ASSETS.events[index]!}
                alt={t(locale, keys.alt)}
                width={400}
                height={265}
                sizes="(max-width: 640px) 50vw, 25vw"
                className="mkt-neon-event-img"
              />
              <div className="mkt-neon-event-label">
                <h3>{t(locale, keys.title)}</h3>
                <span aria-hidden="true">↗</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
