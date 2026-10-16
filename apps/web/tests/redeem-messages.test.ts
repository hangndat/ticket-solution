import assert from 'node:assert/strict';
import test from 'node:test';
import { ISSUE_ERROR_CODES } from '@ticket/contracts';
import {
  messageForApiError,
  successMessage,
  timeoutMessage,
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
});

test('isUuid accepts RFC-ish UUIDs only', () => {
  assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true);
  assert.equal(isUuid('fixture-fun-fest'), false);
  assert.equal(isUuid(''), false);
});
