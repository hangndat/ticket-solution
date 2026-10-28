'use client';

import Link from 'next/link';
import {
  attendeeFooter,
  attendeeFooterLinks,
  attendeeFooterTagline,
} from '../attendee-surface';
import { FooterBrand } from '../site-chrome';
import { useAttendeeLocale } from './locale-context';

export function ConsumerFooter() {
  const { t } = useAttendeeLocale();
  return (
    <footer className={attendeeFooter} data-testid="site-footer">
      <FooterBrand />
      <span className={attendeeFooterTagline}>{t('footer.tagline')}</span>
      <nav className={attendeeFooterLinks} aria-label={t('footer.nav')}>
        <Link href="/">{t('nav.events')}</Link>
        <Link href="/redeem">{t('nav.redeem')}</Link>
        <Link href="/account">{t('nav.account')}</Link>
      </nav>
    </footer>
  );
}
