import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePortalSiderOpenKeys,
  writePersistedSiderOpenKeys,
} from '../src/nav/portal-sider-open-keys';

test('mergePortalSiderOpenKeys unions path and persisted keys in stable order', () => {
  assert.deepEqual(
    mergePortalSiderOpenKeys(['nav-event-run'], ['nav-org', 'nav-event-setup']),
    ['nav-org', 'nav-event-run', 'nav-event-setup'],
  );
});

test('mergePortalSiderOpenKeys keeps route parent open when navigating within app', () => {
  const persisted = mergePortalSiderOpenKeys(
    ['nav-event-run'],
    ['nav-org', 'nav-event-run'],
  );
  assert.deepEqual(
    mergePortalSiderOpenKeys(['nav-event-setup'], persisted),
    ['nav-org', 'nav-event-run', 'nav-event-setup'],
  );
});

test('mergePortalSiderOpenKeys ignores unknown keys', () => {
  assert.deepEqual(
    mergePortalSiderOpenKeys(['nav-platform'], ['bogus', 'nav-platform']),
    ['nav-platform'],
  );
});

test('writePersistedSiderOpenKeys does not throw in node (no sessionStorage)', () => {
  writePersistedSiderOpenKeys(['nav-org']);
});
