import { FAQ_ITEMS } from '../content-config';
import { t } from '../copy';
import type { MarketingSectionProps } from './types';

export function FaqSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="faq"
      className="mkt-section mkt-section--paper"
      aria-labelledby="faq-title"
      data-analytics-section="faq"
    >
      <div className="mkt-wrap">
        <h2 id="faq-title" className="mkt-display mkt-h2 mkt-faq">
          {t(locale, 'faq.title')}
        </h2>
        <div className="mkt-faq-list">
        {FAQ_ITEMS.map((item) => (
          <details key={item.id} className="mkt-faq-item">
            <summary className="mkt-faq-question">
              <span className="mkt-faq-question-text">{item.question[locale]}</span>
            </summary>
            <div className="mkt-faq-answer" id={`${item.id}-panel`}>
              <p>{item.answer[locale]}</p>
            </div>
          </details>
        ))}
        </div>
      </div>
    </section>
  );
}
