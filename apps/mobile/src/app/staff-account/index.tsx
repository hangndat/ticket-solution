import { AccountBackToolbar } from '@/navigation/account-back-toolbar';
import { STAFF_DEFAULT_SCAN_HREF } from '@/navigation/staff-default-tab-target';
import { AccountScreen } from '@/screens/account';

export default function StaffAccountRootIndex() {
  return (
    <>
      <AccountScreen presentation="stack" />
      <AccountBackToolbar fallbackHref={STAFF_DEFAULT_SCAN_HREF} />
    </>
  );
}
