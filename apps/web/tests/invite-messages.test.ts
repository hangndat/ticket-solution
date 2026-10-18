import assert from 'node:assert/strict';
import test from 'node:test';
import { PLATFORM_ERROR_CODES } from '../src/platform/contracts';
import {
  inviteNetworkMessage,
  messageForInviteError,
  messageForInviteView,
} from '../src/platform/invite-messages';
import { interpretAcceptInvite } from '../src/platform/shape';

test('INVITE_ALREADY_USED has distinct VI copy (no English code as title)', () => {
  const msg = messageForInviteError(PLATFORM_ERROR_CODES.INVITE_ALREADY_USED);
  assert.equal(msg.kind, 'used');
  assert.match(msg.title, /đã được dùng/i);
  assert.equal(
    /INVITE_ALREADY_USED|Nest|BFF/i.test(`${msg.title} ${msg.detail}`),
    false,
  );
});

test('INVITE_INVALID_OR_EXPIRED covers expiry / wrong account in VI', () => {
  const msg = messageForInviteError(
    PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
  );
  assert.equal(msg.kind, 'invalid');
  assert.match(msg.title, /hết hạn|không hợp lệ/i);
  assert.match(msg.detail, /email|tài khoản/i);
  assert.equal(
    /INVITE_INVALID_OR_EXPIRED/i.test(`${msg.title} ${msg.detail}`),
    false,
  );
});

test('CSRF Origin mismatch fail-closed copy is VI', () => {
  const msg = messageForInviteError('CSRF_ORIGIN_MISMATCH');
  assert.equal(msg.kind, 'auth');
  assert.match(msg.title, /từ chối/i);
  assert.match(msg.detail, /fail-closed|Origin/i);
});

test('UNAUTHENTICATED asks for Keycloak login', () => {
  const msg = messageForInviteError(PLATFORM_ERROR_CODES.UNAUTHENTICATED);
  assert.equal(msg.kind, 'auth');
  assert.equal(msg.title, 'Cần đăng nhập');
});

test('network message never claims success', () => {
  const msg = inviteNetworkMessage();
  assert.equal(msg.kind, 'network');
  assert.equal(/đã nhận|thành công/i.test(msg.title), false);
  assert.match(msg.detail, /Không coi là đã nhận/i);
});

test('messageForInviteView maps interpretAcceptInvite reject', () => {
  const view = interpretAcceptInvite(
    409,
    {
      code: PLATFORM_ERROR_CODES.INVITE_ALREADY_USED,
      message: 'Invite already used',
    },
    false,
  );
  assert.equal(view.kind, 'rejected');
  const ux = messageForInviteView(view);
  assert.equal(ux.kind, 'used');
  assert.match(ux.title, /đã được dùng/i);
});

test('ok accept view is success with membership ids', () => {
  const view = interpretAcceptInvite(
    200,
    {
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      status: 'ACTIVE',
    },
    false,
  );
  assert.equal(view.kind, 'ok');
  const ux = messageForInviteView(view);
  assert.equal(ux.kind, 'success');
  assert.match(ux.detail, /22222222-2222-4222-8222-222222222222/);
});
