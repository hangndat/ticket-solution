'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from './brand-mark';
import { useBranding } from './branding';
import {
  GUEST_NAV_LINKS,
  type NavLink,
} from './nav/capabilities';
import { loadNavCapabilities } from './nav/load-nav-capabilities';

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
 */
export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const [links, setLinks] = useState<NavLink[]>(GUEST_NAV_LINKS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { links: next } = await loadNavCapabilities();
        if (!cancelled) setLinks(next);
      } catch {
        if (!cancelled) setLinks(GUEST_NAV_LINKS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav aria-label="Điều hướng chính" data-testid="site-nav">
      <Wordmark />
      <span className="nav-links">
        {links.map((item) => (
          <Link key={item.href} href={item.href} data-testid={item.testId}>
            {item.label}
          </Link>
        ))}
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
