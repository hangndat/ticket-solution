import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isGuestShell,
  isStaffWorkspace,
  showAttendeeNativeTabs,
  showAttendeeTabs,
} from './staff-workspace.ts';
import { STAFF_TAB_TITLES } from './staff-tab-titles.ts';
import {
  STAFF_DEFAULT_SCAN_HREF,
  STAFF_TAB_SEGMENT_NAMES,
  shouldReplaceWithStaffScanTab,
} from './staff-default-tab-target.ts';

const staffEligibility = {
  resolved: true,
  loading: false,
  staffEligible: true,
};

const attendeeEligibility = {
  resolved: true,
  loading: false,
  staffEligible: false,
};

test('K-STAFF-01: staff workspace exposes exactly three tab segments', () => {
  assert.deepEqual(STAFF_TAB_SEGMENT_NAMES, [
    'staff-manual',
    'staff-scan',
    'staff-history',
  ]);
  assert.equal(Object.keys(STAFF_TAB_TITLES).length, 3);
  assert.equal(STAFF_TAB_TITLES.scan, 'Quét vé');
});

test('K-STAFF-01: staff workspace hides attendee tabs until MeEvents resolves', () => {
  assert.equal(
    isStaffWorkspace({ status: 'verified' }, staffEligibility),
    true,
  );
  assert.equal(
    showAttendeeTabs({ status: 'verified' }, staffEligibility),
    false,
  );
  assert.equal(
    showAttendeeTabs({ status: 'verified' }, attendeeEligibility),
    true,
  );
  assert.equal(
    showAttendeeNativeTabs({ status: 'signed-out' }, attendeeEligibility),
    false,
  );
  assert.equal(
    showAttendeeNativeTabs({ status: 'verified' }, attendeeEligibility),
    true,
  );
  assert.equal(
    showAttendeeNativeTabs({ status: 'verified' }, staffEligibility),
    false,
  );
  assert.equal(isGuestShell({ status: 'signed-out' }), true);
  assert.equal(isGuestShell({ status: 'verified' }), false);
  assert.equal(
    isStaffWorkspace({ status: 'verified' }, {
      ...staffEligibility,
      staffEligible: false,
    }),
    false,
  );
});

test('K-STAFF-01: staff default tab is Scan when entering workspace or on attendee tabs', () => {
  assert.equal(STAFF_DEFAULT_SCAN_HREF, '/(tabs)/staff-scan');

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: false,
      segments: ['(tabs)', '(events)'],
      enteringStaff: true,
    }),
    false,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', '(events)'],
      enteringStaff: true,
    }),
    true,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-scan'],
      enteringStaff: false,
    }),
    false,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: false,
    }),
    false,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'my-tickets'],
      enteringStaff: false,
    }),
    true,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['account'],
      enteringStaff: false,
    }),
    false,
    'stack /account from gate toolbar must not bounce to Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'account'],
      enteringStaff: false,
    }),
    false,
    'attendee account tab segment must not bounce to Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['staff-account'],
      enteringStaff: false,
    }),
    false,
    'root /staff-account from gate toolbar must not bounce to Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: true,
    }),
    true,
    'first staff entry: NativeTabs opens Manual first → one-shot replace Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: false,
    }),
    false,
    'after entry, intentional Manual tab must not bounce to Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-scan'],
      enteringStaff: true,
    }),
    false,
    'staff entry already on Scan must not replace again',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: false,
      pendingScanLanding: true,
    }),
    true,
    'return from staff-account must select Scan not Manual',
  );
});
