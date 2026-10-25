'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@ticket/ui';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@ticket/ui/client';
import { cn } from '../lib/utils';
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
import type { NavLink } from './nav/capabilities';
import { bindNavCapabilitiesAuthzObserver } from './nav/bind-fetch-authz-observer';
import {
  navCapabilitiesStore,
  type NavCapabilitiesSnapshot,
} from './nav/nav-capabilities-store';
import {
  navSessionAvatarFromText,
  type NavSessionAvatar,
} from './nav/nav-session-avatar';

/** Platform / tenant wordmark — defaults to Vemoki lockup from ThemeProvider. */
export function Wordmark({ href = '/' }: { href?: string }) {
  const branding = useBranding();
  const label = `${branding.displayName} — trang chủ`;
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
    <Link key={item.href} href={item.href} prefetch={true} {...common}>
      {item.label}
    </Link>
  );
}

/**
 * SiteNav — links from server capabilities (MeEvents / MeTenants / PlatformMe).
 * Starts deny-by-default (guest); never hardcodes Admin/Cổng/Platform by route.
 * SEC-CACHE: clears staff links on MEMBERSHIP_* 401/403; refetches on focus/visibility.
 */
export function SiteNav({
  trailing,
  initialSnapshot,
  initialAvatar,
}: {
  trailing?: ReactNode;
  initialSnapshot?: NavCapabilitiesSnapshot;
  initialAvatar?: NavSessionAvatar | null;
}) {
  const pathname = usePathname() ?? '/';
  const [links, setLinks] = useState<NavLink[]>(
    () => initialSnapshot?.links ?? navCapabilitiesStore.getSnapshot().links,
  );
  const [authenticated, setAuthenticated] = useState(
    () =>
      initialSnapshot?.caps.authenticated ??
      navCapabilitiesStore.getSnapshot().caps.authenticated,
  );
  const [mobileMenu, setMobileMenu] = useState({ path: '', open: false });
  const mobileOpen = mobileMenu.open && mobileMenu.path === pathname;
  const [avatarInitials, setAvatarInitials] = useState<string | null>(
    () => initialAvatar?.initials ?? null,
  );
  const [displayHint, setDisplayHint] = useState<string | null>(
    () => initialAvatar?.displayHint ?? null,
  );

  useEffect(() => {
    if (initialSnapshot?.resolved) {
      navCapabilitiesStore.hydrateFromServer(initialSnapshot);
    }
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
  }, [initialSnapshot]);

  useEffect(() => {
    if (!authenticated) {
      setAvatarInitials(null);
      setDisplayHint(null);
      return;
    }
    if (initialAvatar?.initials || initialAvatar?.displayHint) {
      return;
    }
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
        const avatar = navSessionAvatarFromText(body);
        if (!cancelled && avatar) {
          if (avatar.initials) setAvatarInitials(avatar.initials);
          if (avatar.displayHint) setDisplayHint(avatar.displayHint);
        }
      } catch {
        /* fail-closed — nav still works without avatar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, initialAvatar]);

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
        aria-label="Điều hướng chính"
        data-testid="site-nav"
      >
        <Wordmark />
        <span className={attendeeNavLinksDesktop}>
          {links.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              active={isNavLinkActive(pathname, item.href)}
            />
          ))}
          {trailing}
        </span>
        {authenticated ? (
          <Link
            href="/account"
            prefetch={true}
            className={attendeeNavAvatar}
            data-testid="nav-avatar"
            aria-label={displayHint ?? 'Tài khoản'}
          >
            <span className={attendeeNavAvatarBadge} aria-hidden="true">
              {avatarInitials ?? '··'}
            </span>
            <span
              className={cn(
                attendeeNavAvatarLabel,
                !displayHint && 'text-transparent select-none',
              )}
              aria-hidden={!displayHint}
            >
              {displayHint ?? 'user@vemoki.com'}
            </span>
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
                {mobileOpen ? 'Đóng' : 'Menu'}
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
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            {links.map((item) => (
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
