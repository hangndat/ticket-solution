import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from './brand-mark';

/** Platform wordmark — canonical `vemoki↗` from brand/vemoki/tokens.json */
export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="Vemoki — trang chủ">
      <BrandMark />
      vemoki<span aria-hidden="true">↗</span>
    </Link>
  );
}

type NavVariant = 'guest' | 'staff' | 'admin' | 'platform';

const LINKS: Record<NavVariant, { href: string; label: string }[]> = {
  guest: [
    { href: '/redeem', label: 'Đổi mã' },
    { href: '/claim', label: 'Nhận lời mời' },
    { href: '/invite', label: 'Invite thành viên' },
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
