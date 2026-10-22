import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from './copy';
import {
  demoHref,
  loginHref,
  productOriginFromEnv,
  type MarketingLocale,
} from './hosts';
import { LocaleSwitch } from './locale-switch';
import { MarketingMobileNavMenu } from './marketing-mobile-nav-menu';
import { privacyHref, salesHref, supportHref } from './links';

export function MarketingChrome({
  locale,
  pageKind,
  children,
}: {
  locale: MarketingLocale;
  pageKind: 'sales' | 'privacy' | 'support';
  children: ReactNode;
}) {
  const productOrigin = productOriginFromEnv();
  const demo = demoHref(productOrigin);
  const login = loginHref(productOrigin);
  const sales = salesHref(locale);
  const onSales = pageKind === 'sales';

  return (
    <div
      className="mkt mkt--uplift"
      data-testid="marketing-surface"
      data-locale={locale}
    >
      <a className="mkt-skip skip-link" href="#main">
        {t(locale, 'skip')}
      </a>
      <header
        className={`mkt-header${onSales ? ' mkt-header--on-ink mkt-header--sales' : ''}`}
        data-testid="mkt-header"
      >
        <Link
          className="mkt-wordmark"
          href={sales}
          aria-label={t(locale, 'nav.brand')}
          data-testid="mkt-wordmark"
        >
          {t(locale, 'nav.brand')}
          <span aria-hidden="true">↗</span>
        </Link>
        <nav className="mkt-nav" aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
          <LocaleSwitch locale={locale} pageKind={pageKind} />
          {onSales ? (
            <>
              <span className="mkt-nav-links">
                <a href={`${sales}#features`}>{t(locale, 'nav.features')}</a>
                <a href={`${sales}#how_it_works`}>{t(locale, 'nav.how')}</a>
                <a href={`${sales}#solutions`}>{t(locale, 'nav.solutions')}</a>
                <a href={`${sales}#faq`}>{t(locale, 'nav.faq')}</a>
                <a href={demo}>{t(locale, 'nav.demo')}</a>
              </span>
              <MarketingMobileNavMenu
                locale={locale}
                sales={sales}
                demo={demo}
                login={login}
              />
            </>
          ) : null}
          <a className="mkt-btn mkt-btn--ghost mkt-nav-cta mkt-nav-cta--header" href={login}>
            {t(locale, 'nav.login')}
          </a>
          {onSales ? (
            <Link
              className="mkt-btn mkt-btn--primary mkt-nav-cta--header"
              href={`${sales}#interest`}
              data-testid="cta-interest-nav"
            >
              {t(locale, 'nav.interest')}
            </Link>
          ) : (
            <a className="mkt-btn mkt-btn--primary" href={demo}>
              {t(locale, 'nav.demo')}
            </a>
          )}
        </nav>
      </header>
      {children}
      <footer
        className={`mkt-footer${onSales ? ' mkt-section--ink' : ''}`}
        data-testid="mkt-footer"
      >
        <div className="mkt-wrap">
          <div>
            <Link href={privacyHref(locale)}>{t(locale, 'nav.privacy')}</Link>
            {' · '}
            <Link href={supportHref(locale)}>{t(locale, 'nav.support')}</Link>
            {' · '}
            <a href={demo}>{t(locale, 'footer.attendee')}</a>
          </div>
          <div>{t(locale, 'footer.tagline')}</div>
        </div>
      </footer>
    </div>
  );
}
