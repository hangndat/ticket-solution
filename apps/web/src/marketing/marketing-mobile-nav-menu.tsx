'use client';

import { useState } from 'react';
import { Button } from '@ticket/ui';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@ticket/ui/client';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import {
  marketingNavMenuToggle,
  marketingNavMobileActions,
  marketingNavMobileLink,
} from './marketing-surface';
import { InterestCtaAnchor } from './interest-cta-link';

const MENU_ID = 'mkt-nav-mobile-menu';

export function MarketingMobileNavMenu({
  locale,
  sales,
  demo,
  login,
}: {
  locale: MarketingLocale;
  sales: string;
  demo: string;
  login: string;
}) {
  const [open, setOpen] = useState(false);

  const closeMobile = () => setOpen(false);

  const sectionLinks = [
    { href: `${sales}#product`, label: t(locale, 'nav.product') },
    { href: `${sales}#events`, label: t(locale, 'nav.solutions') },
    { href: `${sales}#interest`, label: t(locale, 'nav.advisory') },
    { href: demo, label: t(locale, 'nav.demo') },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghostOnInk"
          className={marketingNavMenuToggle}
          aria-controls={MENU_ID}
          aria-haspopup="dialog"
          data-testid="mkt-nav-menu-toggle"
        >
          <span className="sr-only">
            {open ? t(locale, 'nav.menu.close') : t(locale, 'nav.menu.open')}
          </span>
          <span className="text-lg leading-none" aria-hidden="true">
            {open ? '×' : '☰'}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        id={MENU_ID}
        side="right"
        showCloseButton={false}
        data-testid="mkt-nav-mobile-menu"
        overlayTestId="mkt-nav-mobile-backdrop"
        className="border-line/30 bg-ink text-paper motion-reduce:animate-none motion-reduce:transition-none overflow-y-auto p-4"
      >
        <SheetTitle className="sr-only">{t(locale, 'nav.menu.label')}</SheetTitle>
        <nav className="grid gap-1" aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
          {sectionLinks.map((item) =>
            item.href.includes('#interest') ? (
              <InterestCtaAnchor
                key={item.href}
                className={marketingNavMobileLink}
                href={item.href}
                onClick={closeMobile}
              >
                {item.label}
              </InterestCtaAnchor>
            ) : (
              <a
                key={item.href}
                className={marketingNavMobileLink}
                href={item.href}
                onClick={closeMobile}
              >
                {item.label}
              </a>
            ),
          )}
        </nav>
        <div className={marketingNavMobileActions}>
          <Button asChild variant="ghostOnInk" block>
            <a href={login} onClick={closeMobile}>
              {t(locale, 'nav.login')}
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
