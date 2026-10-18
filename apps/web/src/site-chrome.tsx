'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from './brand-mark';
import { useBranding } from './branding';

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

type NavVariant = 'guest' | 'staff' | 'admin' | 'platform';

const LINKS: Record<NavVariant, { href: string; label: string }[]> = {
  guest: [
    { href: '/redeem', label: 'Đổi mã' },
    { href: '/claim', label: 'Nhận lời mời' },
    { href: '/auth', label: 'Đăng nhập' },
  ],
  staff: [
    { href: '/redeem', label: 'Đổi mã' },
    { href: '/gate', label: 'Cổng' },
    { href: '/auth', label: 'Đăng nhập' },
  ],
  admin: [
    { href: '/admin', label: 'Sự kiện' },
    { href: '/platform', label: 'Platform' },
    { href: '/gate', label: 'Cổng' },
    { href: '/account', label: 'Tài khoản' },
    { href: '/auth', label: 'Đăng nhập' },
  ],
  platform: [
    { href: '/admin', label: 'Admin tenant' },
    { href: '/platform', label: 'Platform' },
    { href: '/account', label: 'Tài khoản' },
    { href: '/auth', label: 'Đăng nhập' },
  ],
};

export function SiteNav({
  variant,
  trailing,
}: {
  variant: NavVariant;
  trailing?: ReactNode;
}) {
  return (
    <nav aria-label="Điều hướng chính">
      <Wordmark />
      <span className="nav-links">
        {LINKS[variant].map((item) => (
          <Link key={item.href} href={item.href}>
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
