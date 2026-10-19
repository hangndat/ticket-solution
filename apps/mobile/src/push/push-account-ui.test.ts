import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivePushAccountUi } from './push-account-ui.ts';

test('provider off hides fake enable CTA', () => {
  const ui = derivePushAccountUi({
    provider: null,
    identity: 'verified',
    iosPermission: 'not-determined',
    backend: 'idle',
  });
  assert.equal(ui.action.kind, 'none');
  assert.match(ui.statusLine, /Chưa hỗ trợ/i);
});

test('guest sees sign-in hint without enable button', () => {
  const ui = derivePushAccountUi({
    provider: 'apns',
    identity: 'guest',
    iosPermission: 'not-determined',
    backend: 'idle',
  });
  assert.equal(ui.action.kind, 'sign-in-hint');
  assert.doesNotMatch(ui.statusLine, /token|APNs/i);
});

test('denied routes to settings not enable', () => {
  const ui = derivePushAccountUi({
    provider: 'apns',
    identity: 'verified',
    iosPermission: 'denied',
    backend: 'idle',
  });
  assert.equal(ui.action.kind, 'open-settings');
  assert.equal(ui.actionLabel, 'Mở Cài đặt');
});

test('authorized with POST fail does not claim permission off', () => {
  const ui = derivePushAccountUi({
    provider: 'apns',
    identity: 'verified',
    iosPermission: 'authorized',
    backend: 'failed',
  });
  assert.match(ui.statusLine, /Đã bật trên iPhone/);
  assert.equal(ui.action.kind, 'retry-server');
  assert.doesNotMatch(ui.detailLine ?? '', /chưa bật quyền|tắt quyền/i);
});

test('notDetermined offers enable label', () => {
  const ui = derivePushAccountUi({
    provider: 'apns',
    identity: 'verified',
    iosPermission: 'not-determined',
    backend: 'idle',
  });
  assert.equal(ui.action.kind, 'enable');
  assert.equal(ui.actionLabel, 'Bật thông báo');
});
