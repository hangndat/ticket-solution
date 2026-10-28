import { Redirect, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { session } from '@/identity/session';
import { GUEST_HOME_HREF } from '@/navigation/attendee-account-route';
import { STAFF_DEFAULT_SCAN_HREF } from '@/navigation/staff-default-tab-target';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';

export default function IndexRoute() {
  const staffWorkspace = useStaffWorkspace();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  if (identity.status !== 'verified') {
    return <Redirect href={GUEST_HOME_HREF as Href} />;
  }
  if (staffWorkspace) {
    return <Redirect href={STAFF_DEFAULT_SCAN_HREF as Href} />;
  }
  return <Redirect href={'/(tabs)/(events)' as Href} />;
}
