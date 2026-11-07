import { useEffect, useSyncExternalStore } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AccountBackToolbar } from '@/navigation/account-back-toolbar';
import { STAFF_DEFAULT_SCAN_HREF } from '@/navigation/staff-default-tab-target';
import { AccountScreen } from '@/screens/account';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';

export default function StaffAccountRootIndex() {
  const { fromPrivacyCold } = useLocalSearchParams<{
    fromPrivacyCold?: string;
  }>();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const eligibility = useSyncExternalStore(
    staffEligibility.subscribe,
    staffEligibility.getSnapshot,
    staffEligibility.getSnapshot,
  );

  useEffect(() => {
    if (
      identity.status === 'verified' &&
      !eligibility.resolved &&
      !eligibility.loading
    ) {
      void staffEligibility.refresh(session);
    }
  }, [identity.status, eligibility.resolved, eligibility.loading]);

  return (
    <>
      <AccountScreen presentation="stack" />
      <AccountBackToolbar
        fallbackHref={STAFF_DEFAULT_SCAN_HREF}
        forceFallback={fromPrivacyCold === '1'}
      />
    </>
  );
}
