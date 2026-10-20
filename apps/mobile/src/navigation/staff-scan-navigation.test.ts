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

test('#596: pendingScanLanding only when leaving account (returnToStaffGateScanTab), not when opening', () => {
  clearStaffScanTabLanding();

  for (const gateTab of ['staff-manual', 'staff-history'] as const) {
    requestStaffScanTabLanding();
    assert.equal(
      shouldReplaceWithStaffScanTab({
        staffWorkspace: true,
        segments: ['(tabs)', gateTab],
        enteringStaff: false,
        pendingScanLanding: true,
      }),
      true,
      `premature flag on ${gateTab} races account push — set flag only on Quay lại quét`,
    );
    clearStaffScanTabLanding();
  }

  requestStaffScanTabLanding();
  assert.equal(
    shouldReplaceWithStaffScanTab({
      staffWorkspace: true,
      segments: ['(tabs)', 'staff-manual'],
      enteringStaff: false,
      pendingScanLanding: true,
    }),
    true,
    'after Quay lại quét from staff-account, Manual must redirect to Scan',
  );
});

