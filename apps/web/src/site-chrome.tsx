'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
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

/**
 * SiteNav — links from server capabilities (MeEvents / MeTenants / PlatformMe).
 * Starts deny-by-default (guest); never hardcodes Admin/Cổng/Platform by route.
 * SEC-CACHE: clears staff links on MEMBERSHIP_* 401/403; refetches on focus/visibility.
 */
export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const [links, setLinks] = useState<NavLink[]>(
    () => navCapabilitiesStore.getSnapshot().links,
  );

  useEffect(() => {
    bindNavCapabilitiesAuthzObserver();
    const unsub = navCapabilitiesStore.subscribe(() => {
      setLinks(navCapabilitiesStore.getSnapshot().links);
    });
    void navCapabilitiesStore.refresh();

    /** Session refresh / tab foreground — revalidate discovery (O02 §6). */
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void navCapabilitiesStore.refresh();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache restore or soft navigation back — treat as session refresh.
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

  return (
    <nav aria-label="Điều hướng chính" data-testid="site-nav">
      <Wordmark />
      <span className="nav-links">
        {links.map((item) =>
          item.href.startsWith('/api/') ? (
            <a key={item.href} href={item.href} data-testid={item.testId}>
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} data-testid={item.testId}>
              {item.label}
            </Link>
          ),
        )}
        {trailing}
      </span>
    </nav>
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
