import { Button } from '@ticket/ui';
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
import {
  marketingFooter,
  marketingHeader,
  marketingNav,
  marketingNavLinks,
  marketingSkip,
  marketingSurface,
  marketingWordmark,
  marketingWrap,
} from './marketing-surface';
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
  const onInk = onSales;

  return (
    <div
      className={marketingSurface}
      data-testid="marketing-surface"
      data-locale={locale}
    >
      <a className={marketingSkip} href="#main">
        {t(locale, 'skip')}
      </a>
      <header
        className={marketingHeader(onSales, onInk)}
        data-testid="mkt-header"
        data-header-on-ink={onInk ? '' : undefined}
      >
        <Link
          className={marketingWordmark}
          href={sales}
          aria-label={t(locale, 'nav.brand')}
          data-testid="mkt-wordmark"
        >
          {t(locale, 'nav.brand')}
          <span aria-hidden="true">↗</span>
        </Link>
        <nav className={marketingNav} aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
          <LocaleSwitch locale={locale} pageKind={pageKind} onInk={onInk} />
          {onSales ? (
            <>
              <span className={marketingNavLinks}>
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
          <Button
            asChild
            variant={onInk ? 'ghostOnInk' : 'ghost'}
            className="ml-[0.15rem] max-md:hidden"
          >
            <a href={login}>{t(locale, 'nav.login')}</a>
          </Button>
          {onSales ? (
            <Button
              asChild
              variant="primary"
              className="whitespace-nowrap max-md:hidden"
            >
              <Link href={`${sales}#interest`} data-testid="cta-interest-nav">
                {t(locale, 'nav.interest')}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="primary">
              <a href={demo}>{t(locale, 'nav.demo')}</a>
            </Button>
          )}
        </nav>
      </header>
      {children}
      <footer className={marketingFooter(onSales)} data-testid="mkt-footer">
        <div className={marketingWrap}>
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
