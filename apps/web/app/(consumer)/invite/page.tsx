import type { Metadata } from 'next';
import { invitePageCopy } from '../../../src/invite/invite-copy';
import { guestPageMain } from '../../../src/guest/guest-flow-surface';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import { portalOriginFromEnv } from '../../../src/portal/dual-run';
import { InviteAcceptForm } from './invite-accept';
import { InviteHomeLink, InvitePageHeader } from './invite-page-chrome';

const defaultInviteCopy = invitePageCopy();

export const metadata: Metadata = {
  title: defaultInviteCopy.title,
  description: defaultInviteCopy.metaDescription,
  referrer: 'no-referrer',
};

export default function InvitePage() {
  return (
    <ConsumerPageShell mainClassName={guestPageMain}>
      <InvitePageHeader />
      <InviteAcceptForm portalOrigin={portalOriginFromEnv()} />
      <InviteHomeLink />
    </ConsumerPageShell>
  );
}
