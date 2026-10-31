'use client';

import Link from 'next/link';
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
        <button
          type="button"
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
        </button>
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
          {sectionLinks.map((item) => (
            <a
              key={item.href}
              className={marketingNavMobileLink}
              href={item.href}
              onClick={closeMobile}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className={marketingNavMobileActions}>
          <Button asChild variant="ghostOnInk" block>
            <a href={login} onClick={closeMobile}>
              {t(locale, 'nav.login')}
            </a>
          </Button>
          <Button asChild variant="primary" block>
            <Link
              href={`${sales}#interest`}
              data-testid="cta-interest-nav-mobile"
              onClick={closeMobile}
            >
              {t(locale, 'nav.interest')}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
