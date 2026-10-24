import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  attendeeFooter,
  attendeeFooterLinks,
  attendeeFooterTagline,
} from '../../src/attendee-surface';
import { FooterBrand } from '../../src/site-chrome';

/** Consumer product routes — attendee footer; marketing uses its own chrome (no double footer). */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <footer className={attendeeFooter} data-testid="site-footer">
        <FooterBrand />
        <span className={attendeeFooterTagline}>Sự kiện & vé</span>
        <nav className={attendeeFooterLinks} aria-label="Liên kết chân trang">
          <Link href="/">Khám phá</Link>
          <Link href="/redeem">Đổi mã</Link>
          <Link href="/account">Tài khoản</Link>
        </nav>
      </footer>
    </>
  );
}
