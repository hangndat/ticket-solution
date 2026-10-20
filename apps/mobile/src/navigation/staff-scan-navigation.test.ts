import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldReplaceWithStaffScanTab } from './staff-default-tab-target.ts';
import {
  clearStaffScanTabLanding,
  peekStaffScanTabLanding,
  requestStaffScanTabLanding,
} from './staff-scan-tab-landing.ts';

test('pendingScanLanding replaces Manual after root staff-account pop', () => {
  clearStaffScanTabLanding();
  requestStaffScanTabLanding();
  assert.equal(peekStaffScanTabLanding(), true);

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: false,
      pendingScanLanding: true,
    }),
    true,
  );

  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['staff-account'],
      enteringStaff: false,
      pendingScanLanding: true,
    }),
    false,
  );
});

