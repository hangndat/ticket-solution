import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeIosNotificationPermission,
  requestIosNotificationPermissionIfNeeded,
} from './push-permission.ts';

test('normalize maps expo permission strings', () => {
  assert.equal(normalizeIosNotificationPermission('undetermined'), 'not-determined');
  assert.equal(normalizeIosNotificationPermission('granted'), 'authorized');
  assert.equal(normalizeIosNotificationPermission('denied'), 'denied');
});

test('request is skipped when already denied', async () => {
  let requests = 0;
  const notifications = {
    async getPermissionsAsync() {
      return { status: 'denied' };
    },
    async requestPermissionsAsync() {
      requests += 1;
      return { status: 'denied' };
    },
  };
  const result = await requestIosNotificationPermissionIfNeeded(notifications);
  assert.equal(result, 'denied');
  assert.equal(requests, 0);
});

test('request runs once when not determined', async () => {
  let requests = 0;
  const notifications = {
    async getPermissionsAsync() {
      return { status: 'undetermined' };
    },
    async requestPermissionsAsync() {
      requests += 1;
      return { status: 'granted' };
    },
  };
  const result = await requestIosNotificationPermissionIfNeeded(notifications);
  assert.equal(result, 'authorized');
  assert.equal(requests, 1);
});
