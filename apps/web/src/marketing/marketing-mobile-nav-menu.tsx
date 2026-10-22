'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@ticket/ui/client';
import { t } from './copy';
import type { MarketingLocale } from './hosts';

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
    { href: `${sales}#features`, label: t(locale, 'nav.features') },
    { href: `${sales}#how_it_works`, label: t(locale, 'nav.how') },
    { href: `${sales}#solutions`, label: t(locale, 'nav.solutions') },
    { href: `${sales}#faq`, label: t(locale, 'nav.faq') },
    { href: demo, label: t(locale, 'nav.demo') },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="mkt-nav-menu-toggle"
          aria-controls={MENU_ID}
          aria-haspopup="dialog"
          data-testid="mkt-nav-menu-toggle"
        >
          <span className="mkt-nav-menu-toggle__label">
            {open ? t(locale, 'nav.menu.close') : t(locale, 'nav.menu.open')}
          </span>
          <span className="mkt-nav-menu-toggle__icon leading-none" aria-hidden="true">
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
        overlayClassName="mkt-nav-mobile-backdrop"
        className="mkt-nav-mobile-menu border-line/30 bg-ink text-paper motion-reduce:animate-none motion-reduce:transition-none overflow-y-auto p-4"
      >
        <SheetTitle className="sr-only">{t(locale, 'nav.menu.label')}</SheetTitle>
        <nav aria-label={locale === 'en' ? 'Primary' : 'Chính'}>
          {sectionLinks.map((item) => (
            <a
              key={item.href}
              className="mkt-nav-mobile-link"
              href={item.href}
              onClick={closeMobile}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mkt-nav-mobile-cta">
          <a
            className="mkt-btn mkt-btn--ghost mkt-nav-mobile-cta__login"
            href={login}
            onClick={closeMobile}
          >
            {t(locale, 'nav.login')}
          </a>
          <Link
            className="mkt-btn mkt-btn--primary"
            href={`${sales}#interest`}
            data-testid="cta-interest-nav-mobile"
            onClick={closeMobile}
          >
            {t(locale, 'nav.interest')}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
