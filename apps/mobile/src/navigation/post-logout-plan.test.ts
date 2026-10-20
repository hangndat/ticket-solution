import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planPostLogoutNavigation } from './post-logout-plan.ts';

test('planPostLogoutNavigation guest home after root staff-account logout', () => {
  assert.deepEqual(
    planPostLogoutNavigation({
      segments: ['staff-account'],
      staffWorkspace: true,
    }),
    { kind: 'guest-replace' },
  );
  assert.deepEqual(
    planPostLogoutNavigation({
      segments: ['(tabs)', 'staff-scan'],
      staffWorkspace: true,
    }),
    { kind: 'guest-replace' },
  );
});
