import { FAQ_ITEMS } from '../content-config';
import { t } from '../copy';
import {
  marketingFaqAnswer,
  marketingFaqItem,
  marketingFaqList,
  marketingFaqQuestion,
  marketingFaqQuestionText,
  marketingFaqSectionTitle,
  marketingSection,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function FaqSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="faq"
      className={marketingSection('paper')}
      aria-labelledby="faq-title"
      data-analytics-section="faq"
    >
      <div className={marketingWrap}>
        <h2 id="faq-title" className={marketingFaqSectionTitle}>
          {t(locale, 'faq.title')}
        </h2>
        <div className={marketingFaqList}>
        {FAQ_ITEMS.map((item) => (
          <details key={item.id} className={marketingFaqItem}>
            <summary className={marketingFaqQuestion}>
              <span className={marketingFaqQuestionText}>{item.question[locale]}</span>
            </summary>
            <div className={marketingFaqAnswer} id={`${item.id}-panel`}>
              <p>{item.answer[locale]}</p>
            </div>
          </details>
        ))}
        </div>
      </div>
    </section>
  );
}
