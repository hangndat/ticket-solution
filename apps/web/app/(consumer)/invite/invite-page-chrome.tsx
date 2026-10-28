'use client';

import Link from 'next/link';
import { useAttendeeLocale } from '../../../src/i18n';
import { invitePageCopy } from '../../../src/invite/invite-copy';
import {
  claimInviteHeader,
  claimInviteIntro,
} from '../../../src/guest/guest-flow-surface';

export function InvitePageHeader() {
  const { locale } = useAttendeeLocale();
  const copy = invitePageCopy(locale);
  return (
    <header className={claimInviteHeader}>
      <h1>{copy.title}</h1>
      <p className={claimInviteIntro}>{copy.intro}</p>
    </header>
  );
}

export function InviteHomeLink() {
  const { locale } = useAttendeeLocale();
  const copy = invitePageCopy(locale);
  return (
    <p>
      <Link href="/">{copy.home}</Link>
    </p>
  );
}
