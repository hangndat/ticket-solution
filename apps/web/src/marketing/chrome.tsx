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
import { MarketingNeonEdgeDecor } from './marketing-neon-edge-decor';
import { MarketingNeonScope } from './marketing-neon-scope';
import { MarketingNeonLogo } from './marketing-neon-logo';

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
      {onSales ? <MarketingNeonEdgeDecor /> : null}
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
          {onSales ? (
            <MarketingNeonLogo />
          ) : (
            <span className="font-display text-[1.35rem] font-bold tracking-tight">
              Vemoki
            </span>
          )}
          <span className="sr-only">{t(locale, 'nav.brand')}</span>
        </Link>
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
          {!onSales ? (
            <Button asChild variant="primary">
              <a href={demo}>{t(locale, 'nav.demo')}</a>
            </Button>
          ) : null}
        </nav>
        <LocaleSwitch locale={locale} pageKind={pageKind} onInk={onInk} />
      </header>
      {children}
      <footer className={marketingFooter(onSales)} data-testid="mkt-footer">
        <div className={marketingWrap}>
          {onSales ? (
            <Link
              className={`${marketingWordmark} mkt-neon-wordmark-link mb-4 inline-flex`}
              href={sales}
              aria-label={t(locale, 'nav.brand')}
              data-testid="mkt-footer-wordmark"
            >
              <MarketingNeonLogo />
              <span className="sr-only">{t(locale, 'nav.brand')}</span>
            </Link>
          ) : null}
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
