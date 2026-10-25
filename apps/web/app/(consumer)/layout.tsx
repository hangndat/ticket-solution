import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  attendeeFooter,
  attendeeFooterLinks,
  attendeeFooterTagline,
} from '../../src/attendee-surface';
import { ConsumerSiteHeader } from '../../src/consumer-site-header';
import { FooterBrand } from '../../src/site-chrome';
import { readSubject } from '../../src/oidc/cookies';
import { PrivateContentBoundary } from '../../src/private-content-boundary';

/** Consumer product routes — attendee footer; marketing uses its own chrome (no double footer). */
export default async function ConsumerLayout({ children }: { children: ReactNode }) {
  const initialSubject = await readSubject();
  return (
    <>
      <ConsumerSiteHeader />
      <PrivateContentBoundary initialSubject={initialSubject}>
        {children}
      </PrivateContentBoundary>
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
