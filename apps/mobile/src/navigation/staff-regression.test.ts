import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStaffWorkspace, showAttendeeTabs } from './staff-workspace.ts';
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
  assert.equal(STAFF_TAB_TITLES.scan, 'Scan');
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
      segments: ['(tabs)', 'staff-account'],
      enteringStaff: false,
    }),
    false,
    'staff-account hidden tab from toolbar must not bounce to Scan',
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: true,
    }),
    false,
    'eligibility resolving while already on Manual must not force Scan',
  );
});
