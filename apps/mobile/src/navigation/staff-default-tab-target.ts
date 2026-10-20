import { STAFF_ACCOUNT_SEGMENT } from './staff-account-route.ts';

/** Expo Router segment names for the staff 3-tab workspace (K-STAFF-01). */
export const STAFF_TAB_SEGMENT_NAMES = [
  'staff-manual',
  'staff-scan',
  'staff-history',
] as const;

const STAFF_TAB_SEGMENT_SET = new Set<string>(STAFF_TAB_SEGMENT_NAMES);

/** Attendee tabs staff must leave when gate workspace is active. */
const ATTENDEE_ONLY_TAB_SEGMENTS = new Set(['(events)', 'my-tickets']);

/**
 * Account routes staff may open without replacing to Scan (toolbar / hidden tab).
 * Legacy root `/account` kept for deep links; staff UI uses `staff-account`.
 */
const STAFF_ACCOUNT_SEGMENTS = new Set(['account', STAFF_ACCOUNT_SEGMENT]);

export const STAFF_DEFAULT_SCAN_HREF = '/(tabs)/staff-scan' as const;

/** When staff workspace is active, default landing tab is Scan. */
export function shouldReplaceWithStaffScanTab(input: {
  staffWorkspace: boolean;
  segments: readonly string[];
  enteringStaff: boolean;
}): boolean {
  if (!input.staffWorkspace) return false;

  if (input.segments.some((s) => STAFF_ACCOUNT_SEGMENTS.has(s))) {
    return false;
  }

  const onStaffTab = input.segments.some((s) => STAFF_TAB_SEGMENT_SET.has(s));
  const onAttendeeTab = input.segments.some((s) =>
    ATTENDEE_ONLY_TAB_SEGMENTS.has(s),
  );

  if (onAttendeeTab) return true;
  if (onStaffTab) return false;
  return input.enteringStaff;
}
