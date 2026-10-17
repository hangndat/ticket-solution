import Link from 'next/link';
import { t } from './copy';
import { InterestForm } from './interest-form';
import { MarketingChrome } from './chrome';
import {
  demoHref,
  loginHref,
  productOriginFromEnv,
  type MarketingLocale,
} from './hosts';
import { salesHref } from './links';

export function SalesPage({ locale }: { locale: MarketingLocale }) {
  const productOrigin = productOriginFromEnv();
  const demo = demoHref(productOrigin);
  const login = loginHref(productOrigin);

  return (
    <MarketingChrome locale={locale} pageKind="sales">
      <main id="main" data-testid={`sales-${locale}`}>
        <header className="mkt-hero" id="hero">
          <p className="mkt-hero-brand" data-testid="hero-brand">
            vemoki<span aria-hidden="true">↗</span>
          </p>
          <h1>{t(locale, 'hero.headline')}</h1>
          <p className="mkt-support">{t(locale, 'hero.support')}</p>
          <div className="mkt-cta-row">
            <a
              className="mkt-btn mkt-btn-primary"
              href={demo}
              data-testid="cta-demo"
            >
              {t(locale, 'hero.cta.demo')}
            </a>
            <Link
              className="mkt-btn mkt-btn-secondary"
              href="#interest"
              data-testid="cta-interest"
            >
              {t(locale, 'hero.cta.interest')}
            </Link>
            <a className="mkt-btn-ghost" href={login} data-testid="cta-login">
              {t(locale, 'hero.cta.login')}
            </a>
          </div>
          <p className="mkt-badge" data-testid="demo-badge">
            {t(locale, 'badge.demo')} — {t(locale, 'hero.demo_note')}
          </p>
          <div className="mkt-hero-visual" aria-hidden="true">
            <div className="mkt-hero-visual-label">
              {t(locale, 'hero.visual.label')}
            </div>
            <div className="mkt-hero-visual-meta">
              {t(locale, 'hero.visual.meta')}
            </div>
          </div>
        </header>

        <section id="audience" aria-labelledby="audience-title">
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

        <section id="workflow" aria-labelledby="workflow-title">
          <h2 id="workflow-title">{t(locale, 'workflow.title')}</h2>
          <p className="mkt-lead">{t(locale, 'workflow.lead')}</p>
          <ol className="mkt-steps">
            <li>{t(locale, 'workflow.step1')}</li>
            <li>{t(locale, 'workflow.step2')}</li>
            <li>{t(locale, 'workflow.step3')}</li>
            <li>{t(locale, 'workflow.step4')}</li>
            <li>{t(locale, 'workflow.step5')}</li>
          </ol>
          <p className="mkt-lead mkt-lead-follow">{t(locale, 'workflow.note')}</p>
        </section>

        <section id="whitelabel" aria-labelledby="wl-title">
          <h2 id="wl-title">{t(locale, 'whitelabel.title')}</h2>
          <p className="mkt-lead">{t(locale, 'whitelabel.lead')}</p>
          <div className="mkt-stack">
            <div className="mkt-row">
              <h3>{t(locale, 'whitelabel.point1')}</h3>
              <p>{t(locale, 'whitelabel.point2')}</p>
            </div>
            <div className="mkt-row">
              <h3>{t(locale, 'whitelabel.point3')}</h3>
              <p>{t(locale, 'whitelabel.lead')}</p>
            </div>
          </div>
        </section>

        <section id="trust" aria-labelledby="trust-title">
          <h2 id="trust-title">{t(locale, 'trust.title')}</h2>
          <p className="mkt-lead">{t(locale, 'trust.lead')}</p>
          <div className="mkt-stack">
            <div className="mkt-row">
              <h3>{t(locale, 'trust.p1.title')}</h3>
              <p>{t(locale, 'trust.p1.body')}</p>
            </div>
            <div className="mkt-row">
              <h3>{t(locale, 'trust.p2.title')}</h3>
              <p>{t(locale, 'trust.p2.body')}</p>
            </div>
            <div className="mkt-row">
              <h3>{t(locale, 'trust.p3.title')}</h3>
              <p>{t(locale, 'trust.p3.body')}</p>
            </div>
          </div>
        </section>

        <section id="demo" aria-labelledby="demo-title">
          <h2 id="demo-title">{t(locale, 'demo.title')}</h2>
          <p className="mkt-lead">{t(locale, 'demo.lead')}</p>
          <div className="mkt-demo-banner" role="status">
            {t(locale, 'demo.banner')}
          </div>
          <p className="mkt-demo-cta">
            <a className="mkt-btn mkt-btn-primary" href={demo}>
              {t(locale, 'demo.cta')}
            </a>
          </p>
        </section>

        <section id="interest" aria-labelledby="interest-title">
          <h2 id="interest-title">{t(locale, 'interest.title')}</h2>
          <p className="mkt-lead">{t(locale, 'interest.lead')}</p>
          <InterestForm locale={locale} />
        </section>

        <section aria-labelledby="cta-repeat-title">
          <h2 id="cta-repeat-title">{t(locale, 'cta.repeat.title')}</h2>
          <div className="mkt-cta-row">
            <a className="mkt-btn mkt-btn-primary" href={demo}>
              {t(locale, 'cta.repeat.demo')}
            </a>
            <Link
              className="mkt-btn mkt-btn-secondary"
              href={`${salesHref(locale)}#interest`}
            >
              {t(locale, 'cta.repeat.interest')}
            </Link>
          </div>
        </section>
      </main>
    </MarketingChrome>
  );
}
