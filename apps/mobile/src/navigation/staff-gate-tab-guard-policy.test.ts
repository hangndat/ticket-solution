import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveStaffGateTabPhase } from './staff-gate-tab-guard-policy.ts';

test('logout race: signed-out with stale staffEligible does not mount gate workspace', () => {
  assert.equal(
    resolveStaffGateTabPhase('signed-out', {
      staffEligible: true,
      resolved: true,
      loading: false,
    }),
    'redirect-guest',
  );
});

test('staff gate allows workspace only when verified and eligible', () => {
  assert.equal(
    resolveStaffGateTabPhase('verified', {
      staffEligible: true,
      resolved: true,
      loading: false,
    }),
    'ready',
  );
  assert.equal(
    resolveStaffGateTabPhase('verified', {
      staffEligible: false,
      resolved: true,
      loading: false,
    }),
    'redirect-deny',
  );
});
