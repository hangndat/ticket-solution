import { t } from '../copy';
import type { MarketingSectionProps } from './types';

export function AudienceSection({ locale }: MarketingSectionProps) {
  return (
    <>
      <section
        id="solutions"
        aria-labelledby="audience-title"
        data-analytics-section="solutions"
      >
        <h2 id="audience-title">{t(locale, 'audience.title')}</h2>
        <p className="mkt-lead">{t(locale, 'audience.lead')}</p>
        <div className="mkt-stack">
          <div className="mkt-row">
            <h3>{t(locale, 'audience.owner.title')}</h3>
            <p>{t(locale, 'audience.owner.body')}</p>
          </div>
          <div className="mkt-row">
            <h3>{t(locale, 'audience.agency.title')}</h3>
            <p>{t(locale, 'audience.agency.body')}</p>
          </div>
          <div className="mkt-row">
            <h3>{t(locale, 'audience.staff.title')}</h3>
            <p>{t(locale, 'audience.staff.body')}</p>
          </div>
          <div className="mkt-row">
            <h3>{t(locale, 'audience.guest.title')}</h3>
            <p>{t(locale, 'audience.guest.body')}</p>
          </div>
        </div>
      </section>

      <section id="whitelabel" aria-labelledby="wl-title">
        <h2 id="wl-title">{t(locale, 'whitelabel.title')}</h2>
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
      </section>
    </>
  );
}
