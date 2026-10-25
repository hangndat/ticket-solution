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
import { MarketingNeonScope } from './marketing-neon-scope';

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
      className={marketingSurface(onSales)}
      data-testid="marketing-surface"
      data-locale={locale}
      data-marketing-neon={onSales ? '' : undefined}
    >
      <MarketingNeonScope enabled={onSales} />
      <a className={marketingSkip} href="#main">
        {t(locale, 'skip')}
      </a>
      <header
        className={marketingHeader(onSales, onInk)}
        data-testid="mkt-header"
        data-header-on-ink={onInk ? '' : undefined}
      >
        <Link
          className={`${marketingWordmark} mkt-neon-wordmark-link`}
          href={sales}
          aria-label={t(locale, 'nav.brand')}
          data-testid="mkt-wordmark"
        >
          <span className="mkt-neon-wordmark" aria-hidden="true">
            <span className="mkt-neon-wordmark-v">V</span>
            <span className="mkt-neon-wordmark-rest">emoki</span>
          </span>
          <span className="sr-only">{t(locale, 'nav.brand')}</span>
          <span aria-hidden="true" className="mkt-neon-wordmark-arrow">↗</span>
        </Link>
        <LocaleSwitch locale={locale} pageKind={pageKind} onInk={onInk} />
        <nav className={marketingNav} aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
          {onSales ? (
            <>
              <span className={marketingNavLinks}>
                <a href={`${sales}#product`}>{t(locale, 'nav.product')}</a>
                <a href={`${sales}#events`}>{t(locale, 'nav.solutions')}</a>
                <a href={`${sales}#interest`}>{t(locale, 'nav.advisory')}</a>
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
            className="ml-[0.15rem] shrink-0 max-md:hidden max-xl:whitespace-nowrap"
          >
            <a href={login}>{t(locale, 'nav.login')}</a>
          </Button>
          {onSales ? (
            <Button
              asChild
              variant="primary"
              className="shrink-0 whitespace-nowrap max-md:hidden"
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
