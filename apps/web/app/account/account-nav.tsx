'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  accountNav,
  accountNavLink,
  accountNavLinkActive,
} from '../../src/account/account-flow-surface';

export type AccountNavSection = 'account' | 'privacy';

const LINKS: { id: AccountNavSection; href: string; label: string }[] = [
  { id: 'account', href: '/account', label: 'Tài khoản' },
  { id: 'privacy', href: '/privacy', label: 'Quyền riêng tư' },
];

export function AccountNav({ active }: { active: AccountNavSection }) {
  const pathname = usePathname();

  return (
    <nav className={accountNav} aria-label="Cài đặt tài khoản">
      {LINKS.map((link) => {
        const isActive =
          active === link.id ||
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.id}
            href={link.href}
            className={isActive ? accountNavLinkActive : accountNavLink}
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
