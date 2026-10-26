import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPortalShellSnapshot,
  publishPortalShellSnapshot,
  resetPortalShellSnapshotForTests,
  subscribePortalShellSnapshot,
} from '../src/nav/portal-shell-snapshot';

test('publishPortalShellSnapshot notifies subscribers (shared shell state)', () => {
  resetPortalShellSnapshotForTests();
  let version = 0;
  const unsubscribe = subscribePortalShellSnapshot(() => {
    version += 1;
  });
  assert.equal(getPortalShellSnapshot().status, 'loading');
  publishPortalShellSnapshot({
    status: 'ready',
    caps: { showOrgChrome: true, showPlatform: false, staffEligible: true },
    meTenants: null,
    meEvents: { staffEligible: true, items: [] },
    platformMe: null,
    http: { tenants: 200, events: 200, platform: 401 },
  });
  assert.equal(version, 1);
  assert.equal(getPortalShellSnapshot().status, 'ready');
  unsubscribe();
});
