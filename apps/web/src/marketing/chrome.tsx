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

  return (
    <div className="mkt" data-testid="marketing-surface" data-locale={locale}>
      <a className="skip-link" href="#main">
        {t(locale, 'skip')}
      </a>
      <div className="mkt-wrap">
        <header className="mkt-top">
          <Link
            className="mkt-wordmark"
            href={salesHref(locale)}
            aria-label={t(locale, 'nav.brand')}
            data-testid="mkt-wordmark"
          >
            {t(locale, 'nav.brand')}
            <span aria-hidden="true">↗</span>
          </Link>
          <nav className="mkt-nav" aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
            <LocaleSwitch locale={locale} pageKind={pageKind} />
            <a href={demo}>{t(locale, 'nav.demo')}</a>
            <Link href={`${salesHref(locale)}#interest`}>
              {t(locale, 'nav.interest')}
            </Link>
            <a href={login}>{t(locale, 'nav.login')}</a>
          </nav>
        </header>
        {children}
        <footer className="mkt-footer" data-testid="mkt-footer">
          <div>
            <Link href={privacyHref(locale)}>{t(locale, 'nav.privacy')}</Link>
            {' · '}
            <Link href={supportHref(locale)}>{t(locale, 'nav.support')}</Link>
            {' · '}
            <a href={demo}>{t(locale, 'footer.attendee')}</a>
          </div>
          <div>{t(locale, 'footer.tagline')}</div>
        </footer>
      </div>
    </div>
  );
}
