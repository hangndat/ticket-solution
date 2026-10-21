'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getFocusableElements,
  handleMobileMenuKeyDown,
} from './nav/mobile-menu-focus';
import { BrandMark } from './brand-mark';
import { useBranding } from './branding';
import type { NavLink } from './nav/capabilities';
import { bindNavCapabilitiesAuthzObserver } from './nav/bind-fetch-authz-observer';
import { navCapabilitiesStore } from './nav/nav-capabilities-store';

/** Platform / tenant wordmark — defaults to Vemoki lockup from ThemeProvider. */
export function Wordmark({ href = '/' }: { href?: string }) {
  const branding = useBranding();
  const label = `${branding.displayName} — trang chủ`;
  return (
    <Link
      href={href}
      className="wordmark"
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
}: {
  item: NavLink;
  active: boolean;
  onNavigate?: () => void;
}) {
  const className = active ? 'nav-link nav-link--active' : 'nav-link';
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
    <Link key={item.href} href={item.href} {...common}>
      {item.label}
    </Link>
  );
}

/**
 * SiteNav — links from server capabilities (MeEvents / MeTenants / PlatformMe).
 * Starts deny-by-default (guest); never hardcodes Admin/Cổng/Platform by route.
 * SEC-CACHE: clears staff links on MEMBERSHIP_* 401/403; refetches on focus/visibility.
 */
export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [links, setLinks] = useState<NavLink[]>(
    () => navCapabilitiesStore.getSnapshot().links,
  );
  const [authenticated, setAuthenticated] = useState(
    () => navCapabilitiesStore.getSnapshot().caps.authenticated,
  );
  const [mobileMenu, setMobileMenu] = useState({ path: '', open: false });
  const mobileOpen = mobileMenu.open && mobileMenu.path === pathname;
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
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

  const closeMobile = useCallback(() => {
    setMobileMenu({ path: pathname, open: false });
    queueMicrotask(() => menuToggleRef.current?.focus());
  }, [pathname]);

  const toggleMobile = () =>
    setMobileMenu((prev) =>
      prev.path === pathname
        ? { path: pathname, open: !prev.open }
        : { path: pathname, open: true },
    );

  useEffect(() => {
    if (!mobileOpen) return;

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
  }, [mobileOpen, closeMobile]);

  return (
    <header className="site-header" data-testid="site-header">
      <nav
        className="top-nav site-nav"
        aria-label="Điều hướng chính"
        data-testid="site-nav"
      >
        <Wordmark />
        <span className="nav-links nav-links--desktop">
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
            className="nav-avatar"
            data-testid="nav-avatar"
            aria-label="Tài khoản"
          >
            <span className="nav-avatar__badge" aria-hidden="true">
              {avatarInitials ?? '…'}
            </span>
            {displayHint ? (
              <span className="nav-avatar__label">{displayHint}</span>
            ) : null}
          </Link>
        ) : null}
        <button
          ref={menuToggleRef}
          type="button"
          className="nav-menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="site-nav-mobile-menu"
          aria-haspopup="dialog"
          data-testid="nav-menu-toggle"
          onClick={toggleMobile}
        >
          <span className="nav-menu-toggle__label">
            {mobileOpen ? 'Đóng' : 'Menu'}
          </span>
          <span className="nav-menu-toggle__icon" aria-hidden="true">
            {mobileOpen ? '×' : '☰'}
          </span>
        </button>
      </nav>
      {mobileOpen ? (
        <div
          ref={mobileMenuRef}
          id="site-nav-mobile-menu"
          className="nav-mobile-menu"
          data-testid="nav-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
        >
          {links.map((item) => (
            <NavLinkItem
              key={`mobile-${item.href}`}
              item={item}
              active={isNavLinkActive(pathname, item.href)}
              onNavigate={closeMobile}
            />
          ))}
          {trailing}
        </div>
      ) : null}
    </header>
  );
}

/** Footer brand lockup — mirrors wordmark from ThemeProvider. */
export function FooterBrand() {
  const branding = useBranding();
  return (
    <span className="footer-brand" data-testid="footer-brand">
      {branding.wordmark}
      {branding.signalGlyph ? (
        <span aria-hidden="true">{branding.signalGlyph}</span>
      ) : null}
    </span>
  );
}
