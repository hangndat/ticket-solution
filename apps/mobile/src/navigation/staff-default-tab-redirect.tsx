import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  STAFF_DEFAULT_SCAN_HREF,
  shouldReplaceWithStaffScanTab,
} from '@/navigation/staff-default-tab-target';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';

/** Staff workspace opens on Scan; leave attendee-only tabs when eligibility applies. */
export function StaffDefaultTabRedirect() {
  const staffWorkspace = useStaffWorkspace();
  const router = useRouter();
  const segments = useSegments();
  const wasStaffWorkspace = useRef(false);

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
      })
    ) {
      router.replace(STAFF_DEFAULT_SCAN_HREF);
    }
  }, [staffWorkspace, segments, router]);

  return null;
}
