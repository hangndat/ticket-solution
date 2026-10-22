import { useEffect, useRef, useSyncExternalStore } from 'react';
import { type Href, useRouter, useSegments } from 'expo-router';
import {
  STAFF_DEFAULT_SCAN_HREF,
  shouldReplaceWithStaffScanTab
} from '@/navigation/staff-default-tab-target';
import {
  consumeStaffScanTabLanding,
  peekStaffScanTabLanding,
  subscribeStaffScanTabLanding
} from '@/navigation/staff-scan-tab-landing';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';

/** Staff workspace opens on Scan; leave attendee-only tabs when eligibility applies. */
export function StaffDefaultTabRedirect() {
  const staffWorkspace = useStaffWorkspace();
  const router = useRouter();
  const segments = useSegments();
  const wasStaffWorkspace = useRef(false);
  const pendingScanLanding = useSyncExternalStore(
    subscribeStaffScanTabLanding,
    peekStaffScanTabLanding,
    peekStaffScanTabLanding,
  );

  useEffect(() => {
    if (!staffWorkspace) {
      wasStaffWorkspace.current = false;
      return;
    }
    const enteringStaff = !wasStaffWorkspace.current;
    wasStaffWorkspace.current = true;

    if (
      shouldReplaceWithStaffScanTab({
        staffWorkspace: true,
        segments,
        enteringStaff,
        pendingScanLanding
      })
    ) {
      if (pendingScanLanding) {
        consumeStaffScanTabLanding();
      }
      router.replace(STAFF_DEFAULT_SCAN_HREF as Href);
    }
  }, [staffWorkspace, segments, router, pendingScanLanding]);

  return null;
}
