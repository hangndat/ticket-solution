'use client';

import Link from 'next/link';
import { useAttendeeLocale } from '../../../src/i18n';
import { guestClaimCopy } from '../../../src/guest/claim-copy';
import {
  claimInviteHeader,
  claimInviteIntro,
} from '../../../src/guest/guest-flow-surface';

export function ClaimPageHeader() {
  const { locale } = useAttendeeLocale();
  const copy = guestClaimCopy(locale);
  return (
    <header className={claimInviteHeader}>
      <h1>{copy.title}</h1>
      <p className={claimInviteIntro}>{copy.intro}</p>
    </header>
  );
}

export function ClaimHomeLink() {
  const { locale } = useAttendeeLocale();
  const copy = guestClaimCopy(locale);
  return (
    <p>
      <Link href="/">{copy.home}</Link>
    </p>
  );
}
