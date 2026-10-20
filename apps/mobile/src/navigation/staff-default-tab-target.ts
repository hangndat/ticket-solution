/** Expo Router segment names for the staff 3-tab workspace (K-STAFF-01). */
export const STAFF_TAB_SEGMENT_NAMES = [
  'staff-manual',
  'staff-scan',
  'staff-history',
] as const;

const STAFF_TAB_SEGMENT_SET = new Set<string>(STAFF_TAB_SEGMENT_NAMES);

const ATTENDEE_ONLY_TAB_SEGMENTS = new Set([
  '(events)',
  'my-tickets',
  'account',
]);

export const STAFF_DEFAULT_SCAN_HREF = '/(tabs)/staff-scan' as const;

/** When staff workspace is active, default landing tab is Scan. */
export function shouldReplaceWithStaffScanTab(input: {
  staffWorkspace: boolean;
  segments: readonly string[];
  enteringStaff: boolean;
}): boolean {
  if (!input.staffWorkspace) return false;

  const onStaffTab = input.segments.some((s) => STAFF_TAB_SEGMENT_SET.has(s));
  const onAttendeeTab = input.segments.some((s) =>
    ATTENDEE_ONLY_TAB_SEGMENTS.has(s),
  );

  return onAttendeeTab || !onStaffTab || input.enteringStaff;
}
