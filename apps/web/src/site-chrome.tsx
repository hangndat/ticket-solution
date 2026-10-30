'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@ticket/ui';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@ticket/ui/client';
import {
  attendeeFooterBrand,
  attendeeNavAvatar,
  attendeeNavAvatarBadge,
  attendeeNavAvatarLabel,
  attendeeNavLink,
  attendeeNavLinksDesktop,
  attendeeNavMenuToggle,
  attendeeSheetNav,
  attendeeSheetNavLink,
  attendeeSiteHeader,
  attendeeTopNav,
  attendeeWordmark,
} from './attendee-surface';
import { BrandMark } from './brand-mark';
import { useBranding } from './branding';
import { useAttendeeLocale } from './i18n/locale-context';
import { AttendeeLocaleSwitch } from './i18n/locale-switch';
import { navLabelForTestId } from './i18n/nav-labels';
import type { NavLink } from './nav/capabilities';
import { bindNavCapabilitiesAuthzObserver } from './nav/bind-fetch-authz-observer';
import { navCapabilitiesStore } from './nav/nav-capabilities-store';

/** Platform / tenant wordmark — defaults to Vemoki lockup from ThemeProvider. */
export function Wordmark({ href = '/' }: { href?: string }) {
  const branding = useBranding();
  const { t } = useAttendeeLocale();
  const label = `${branding.displayName} — ${t('nav.brandHome')}`;
  return (
    <Link
      href={href}
      className={attendeeWordmark}
      aria-label={label}
      data-testid="site-wordmark"
      data-branding-source={branding.source}
    >
      <BrandMark />
      {branding.wordmark}
      {branding.signalGlyph ? (
        <span aria-hidden="true">{branding.signalGlyph}</span>
      ) : null}
    </Link>
  );
}

function navHrefPath(href: string): string {
  if (href.startsWith('/api/')) return href;
  return href.split('?')[0] ?? href;
}

function isNavLinkActive(pathname: string, href: string): boolean {
  if (href.startsWith('/api/')) return false;
  const path = navHrefPath(href);
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function initialsFromSession(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const raw =
      typeof parsed.email === 'string'
        ? parsed.email
        : typeof parsed.sub === 'string'
          ? parsed.sub
          : typeof parsed.subject === 'string'
            ? parsed.subject
            : null;
    if (!raw?.trim()) return null;
    const s = raw.trim();
    if (s.includes('@')) {
      const local = s.split('@')[0] ?? s;
      const parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
      }
      return local.slice(0, 2).toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
  } catch {
    return null;
  }
}

function NavLinkItem({
  item,
  active,
  onNavigate,
  mobile,
}: {
  item: NavLink;
  active: boolean;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const className = mobile ? attendeeSheetNavLink(active) : attendeeNavLink(active);
  const common = {
    className,
    'data-testid': item.testId,
    'aria-current': active ? ('page' as const) : undefined,
    onClick: onNavigate,
  };
  if (item.href.startsWith('/api/')) {
    return (
      <a key={item.href} href={item.href} {...common}>
        {item.label}
      </a>
    );
  }
  return (
    <Link key={item.href} href={item.href} prefetch={item.href !== '/wallet'} {...common}>
        {item.label}
    </Link>
  );
}

/**
 * SiteNav — links from server capabilities (MeEvents / MeTenants / PlatformMe).
 * Starts deny-by-default (guest); never hardcodes Admin/Cổng/Platform by route.
 * SEC-CACHE: clears authenticated links on MEMBERSHIP_* 401/403; refetches on focus/visibility.
 */
export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const { locale, t } = useAttendeeLocale();
  const pathname = usePathname() ?? '/';
  const [links, setLinks] = useState<NavLink[]>(
    () => navCapabilitiesStore.getSnapshot().links,
  );
  const [authenticated, setAuthenticated] = useState(
    () => navCapabilitiesStore.getSnapshot().caps.authenticated,
  );
  const [mobileMenu, setMobileMenu] = useState({ path: '', open: false });
  const mobileOpen = mobileMenu.open && mobileMenu.path === pathname;
  const [avatarInitials, setAvatarInitials] = useState<string | null>(null);
  const [displayHint, setDisplayHint] = useState<string | null>(null);

  useEffect(() => {
    bindNavCapabilitiesAuthzObserver();
    const unsub = navCapabilitiesStore.subscribe(() => {
      const snap = navCapabilitiesStore.getSnapshot();
      setLinks(snap.links);
      setAuthenticated(snap.caps.authenticated);
    });
    void navCapabilitiesStore.refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void navCapabilitiesStore.refresh();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void navCapabilitiesStore.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/bff/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const body = await response.text();
        if (cancelled || response.status < 200 || response.status >= 300) {
          return;
        }
        const initials = initialsFromSession(body);
        if (!cancelled) setAvatarInitials(initials);
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          const email =
            typeof parsed.email === 'string' ? parsed.email.trim() : null;
          if (!cancelled && email) setDisplayHint(email);
        } catch {
          /* ignore */
        }
      } catch {
        /* fail-closed — nav still works without avatar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const labeledLinks = useMemo(
    () =>
      links.map((item) => ({
        ...item,
        label: navLabelForTestId(item.testId, locale, item.label),
      })),
    [links, locale],
  );

  const closeMobile = useCallback(() => {
    setMobileMenu({ path: pathname, open: false });
  }, [pathname]);

  const setMobileOpen = useCallback(
    (open: boolean) => {
      setMobileMenu({ path: pathname, open });
    },
    [pathname],
  );

  return (
    <header className={attendeeSiteHeader} data-testid="site-header">
      <nav
        className={attendeeTopNav}
        aria-label={t('nav.primary')}
        data-testid="site-nav"
      >
        <Wordmark />
        <span className={attendeeNavLinksDesktop}>
          {labeledLinks.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              active={isNavLinkActive(pathname, item.href)}
            />
          ))}
          {trailing}
        </span>
        <AttendeeLocaleSwitch />
        {authenticated ? (
          <Link
            href="/account"
            className={attendeeNavAvatar}
            data-testid="nav-avatar"
            aria-label={displayHint ? undefined : t('nav.account')}
          >
            <span className={attendeeNavAvatarBadge} aria-hidden="true">
              {avatarInitials ?? '…'}
            </span>
            {displayHint ? (
              <span className={attendeeNavAvatarLabel}>{displayHint}</span>
            ) : null}
          </Link>
        ) : null}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={attendeeNavMenuToggle}
              aria-controls="site-nav-mobile-menu"
              aria-haspopup="dialog"
              data-testid="nav-menu-toggle"
            >
              <span className="text-xs max-[360px]:sr-only">
                {mobileOpen ? t('nav.menuClose') : t('nav.menu')}
              </span>
              <span className="text-lg leading-none" aria-hidden="true">
                {mobileOpen ? '×' : '☰'}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent
            id="site-nav-mobile-menu"
            side="right"
            showCloseButton={false}
            data-testid="nav-mobile-menu"
            overlayTestId="nav-mobile-backdrop"
            className={attendeeSheetNav}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document
                .querySelector<HTMLButtonElement>(
                  '[data-testid="nav-menu-toggle"]',
                )
                ?.focus();
            }}
          >
            <SheetTitle className="sr-only">{t('nav.menuTitle')}</SheetTitle>
            {labeledLinks.map((item) => (
              <NavLinkItem
                key={`mobile-${item.href}`}
                item={item}
                active={isNavLinkActive(pathname, item.href)}
                onNavigate={closeMobile}
                mobile
              />
            ))}
            {trailing}
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}

/** Footer brand lockup — mirrors wordmark from ThemeProvider. */
export function FooterBrand() {
  const branding = useBranding();
  return (
    <span className={attendeeFooterBrand} data-testid="footer-brand">
      {branding.wordmark}
      {branding.signalGlyph ? (
        <span aria-hidden="true">{branding.signalGlyph}</span>
      ) : null}
    </span>
  );
}
