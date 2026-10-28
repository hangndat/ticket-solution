import type { Metadata } from 'next';
import { guestClaimCopy } from '../../../src/guest/claim-copy';
import { guestPageMain } from '../../../src/guest/guest-flow-surface';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import { GuestClaimForm } from './claim-form';
import { ClaimHomeLink, ClaimPageHeader } from './claim-page-chrome';

/** Client claim form + fragment intent — never SSG a stale empty shell. */
export const dynamic = 'force-dynamic';

const defaultClaimCopy = guestClaimCopy();

export const metadata: Metadata = {
  title: defaultClaimCopy.title,
  description: defaultClaimCopy.metaDescription,
  referrer: 'no-referrer',
};

export default function ClaimPage() {
  return (
    <ConsumerPageShell mainClassName={guestPageMain}>
      <ClaimPageHeader />
      <GuestClaimForm />
      <ClaimHomeLink />
    </ConsumerPageShell>
  );
}
