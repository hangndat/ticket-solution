import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveStaffGateTabPhase,
  staffGateTabRendersChildren,
} from './staff-gate-tab-guard-policy.ts';

test('logout race: signed-out with stale staffEligible does not mount gate workspace', () => {
  const phase = resolveStaffGateTabPhase('signed-out', {
    staffEligible: true,
    resolved: true,
    loading: false,
  });
  assert.equal(phase, 'redirect-guest');
  assert.equal(staffGateTabRendersChildren(phase), false);
});

test('staff gate allows children only under isStaffWorkspace predicate', () => {
  const ready = resolveStaffGateTabPhase('verified', {
    staffEligible: true,
    resolved: true,
    loading: false,
  });
  assert.equal(ready, 'ready');
  assert.equal(staffGateTabRendersChildren(ready), true);

  const deny = resolveStaffGateTabPhase('verified', {
    staffEligible: false,
    resolved: true,
    loading: false,
  });
  assert.equal(deny, 'redirect-deny');
  assert.equal(staffGateTabRendersChildren(deny), false);

  const loading = resolveStaffGateTabPhase('verified', {
    staffEligible: true,
    resolved: false,
    loading: true,
  });
  assert.equal(loading, 'loading');
  assert.equal(staffGateTabRendersChildren(loading), false);
});
