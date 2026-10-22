'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import {
  getFocusableElements,
  handleMobileMenuKeyDown,
} from '../nav/mobile-menu-focus';

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
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobile = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => menuToggleRef.current?.focus());
  }, []);

  const toggleMobile = () => {
    setOpen((prev) => {
      if (prev) {
        queueMicrotask(() => menuToggleRef.current?.focus());
      }
      return !prev;
    });
  };

  useEffect(() => {
    if (!open) return;

    const focusFrame = requestAnimationFrame(() => {
      const menu = mobileMenuRef.current;
      if (!menu) return;
      getFocusableElements(menu)[0]?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      const menu = mobileMenuRef.current;
      if (!menu) return;
      if (event.key === 'Escape') {
        closeMobile();
        event.preventDefault();
        return;
      }
      if (handleMobileMenuKeyDown(event, menu) && event.key === 'Tab') {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, closeMobile]);

  const sectionLinks = [
    { href: `${sales}#features`, label: t(locale, 'nav.features') },
    { href: `${sales}#how_it_works`, label: t(locale, 'nav.how') },
    { href: `${sales}#solutions`, label: t(locale, 'nav.solutions') },
    { href: `${sales}#faq`, label: t(locale, 'nav.faq') },
    { href: demo, label: t(locale, 'nav.demo') },
  ];

  return (
    <>
      <button
        ref={menuToggleRef}
        type="button"
        className="mkt-nav-menu-toggle"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-haspopup="dialog"
        data-testid="mkt-nav-menu-toggle"
        onClick={toggleMobile}
      >
        <span className="mkt-nav-menu-toggle__label">
          {open ? t(locale, 'nav.menu.close') : t(locale, 'nav.menu.open')}
        </span>
        <span className="mkt-nav-menu-toggle__icon" aria-hidden="true">
          {open ? '×' : '☰'}
        </span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="mkt-nav-mobile-backdrop"
            aria-hidden="true"
            tabIndex={-1}
            data-testid="mkt-nav-mobile-backdrop"
            onClick={closeMobile}
          />
          <div
            ref={mobileMenuRef}
            id={MENU_ID}
            className="mkt-nav-mobile-menu"
            data-testid="mkt-nav-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t(locale, 'nav.menu.label')}
          >
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
          </div>
        </>
      ) : null}
    </>
  );
}
