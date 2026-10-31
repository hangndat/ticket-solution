import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePortalSiderOpenKeys,
  readPersistedSiderOpenKeys,
  PORTAL_SIDER_OPEN_KEYS_STORAGE,
  writePersistedSiderOpenKeys,
} from '../src/nav/portal-sider-open-keys';

test('mergePortalSiderOpenKeys unions path and persisted keys in stable order', () => {
  assert.deepEqual(
    mergePortalSiderOpenKeys(['nav-event-run'], ['nav-org', 'nav-event-setup']),
    ['nav-org', 'nav-event-run', 'nav-event-setup'],
  );
});

test('storage rejects malformed values and persists only valid keys', () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    window: {},
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    values.set(PORTAL_SIDER_OPEN_KEYS_STORAGE, '{broken');
    assert.deepEqual(readPersistedSiderOpenKeys(), []);
    values.set(PORTAL_SIDER_OPEN_KEYS_STORAGE, JSON.stringify(['nav-org', 1, 'bad', 'nav-org']));
    assert.deepEqual(readPersistedSiderOpenKeys(), ['nav-org']);
    writePersistedSiderOpenKeys(['nav-org', 'bad']);
    assert.deepEqual(readPersistedSiderOpenKeys(), ['nav-org']);
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
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
