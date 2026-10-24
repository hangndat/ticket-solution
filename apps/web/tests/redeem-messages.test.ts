import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORM_ERROR_CODES,
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
} from '@ticket/contracts';
import {
  messageForApiError,
  successMessage,
  timeoutMessage,
  unknownMessage,
} from '../src/redeem/messages';
import { isUuid } from '../src/bff/ids';

test('maps quota exhausted and code consumed to distinct UX kinds', () => {
  const exhausted = messageForApiError(ISSUE_ERROR_CODES.QUOTA_EXHAUSTED);
  assert.equal(exhausted.kind, 'exhausted');
  assert.equal(exhausted.retryable, false);

  const used = messageForApiError(ISSUE_ERROR_CODES.CODE_CONSUMED);
  assert.equal(used.kind, 'used');
  assert.equal(used.retryable, false);
});

test('timeout and retryable conflict are retryable', () => {
  assert.equal(timeoutMessage().kind, 'timeout');
  assert.equal(timeoutMessage().retryable, true);

  const retry = messageForApiError(ISSUE_ERROR_CODES.RETRYABLE_CONFLICT);
  assert.equal(retry.kind, 'polling');
  assert.equal(retry.retryable, true);
});

test('success message includes ticket id', () => {
  const msg = successMessage('11111111-1111-4111-8111-111111111111', false);
  assert.equal(msg.kind, 'success');
  assert.match(msg.detail, /11111111-1111-4111-8111-111111111111/);
  assert.equal(/Nest|BFF/i.test(`${msg.title} ${msg.detail}`), false);
});

test('FORM_VERSION_STALE is plain VI reload copy (AC-A4)', () => {
  const stale = messageForApiError(FORM_ERROR_CODES.FORM_VERSION_STALE);
  assert.equal(stale.kind, 'stale');
  assert.match(stale.title, /Biểu mẫu đã đổi/);
  assert.match(stale.detail, /đồng ý/);
  assert.equal(/FORM_VERSION_STALE|Nest|BFF/i.test(`${stale.title} ${stale.detail}`), false);
});

test('UNAUTHENTICATED uses Cần đăng nhập (AC-A3)', () => {
  const auth = messageForApiError(IDENTITY_ERROR_CODES.UNAUTHENTICATED);
  assert.equal(auth.kind, 'auth');
  assert.equal(auth.title, 'Cần đăng nhập');
});

test('unknown outcome never claims a ticket (AC-A2)', () => {
  const unknown = unknownMessage('11111111-1111-4111-8111-111111111111');
  assert.equal(unknown.kind, 'unknown');
  assert.match(unknown.detail, /Vui lòng kiểm tra vé/);
  assert.equal(/đã cấp vé|vé của bạn/i.test(unknown.title), false);
});

test('isUuid accepts RFC-ish UUIDs only', () => {
  assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true);
  assert.equal(isUuid('fixture-mfest'), false);
  assert.equal(isUuid(''), false);
});
