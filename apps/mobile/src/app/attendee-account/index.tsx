import { AccountBackToolbar } from '@/navigation/account-back-toolbar';
import { GUEST_HOME_HREF } from '@/navigation/attendee-account-route';
import { AccountScreen } from '@/screens/account';

export default function AttendeeAccountRootIndex() {
  return (
    <>
      <AccountScreen presentation="stack" />
      <AccountBackToolbar fallbackHref={GUEST_HOME_HREF} />
    </>
  );
}
