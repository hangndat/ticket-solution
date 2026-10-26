import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretCsResend } from '../src/ops/cs';
import { interpretNotificationRetry } from '../src/ops/notifications';

test('CS resend and notification retry only report queued with definitive response', () => {
  assert.equal(interpretCsResend(202, { operationId: 'o1', notificationId: 'n1', providerStatus: 'PENDING', replayed: false }, false, 't1').kind, 'unknown');
  assert.equal(interpretCsResend(200, { operationId: 'o1', notificationId: 'n1', providerStatus: 'FAILED', replayed: false }, false, 't1').kind, 'unknown');
  assert.equal(interpretNotificationRetry(202, { notificationId: 'n1', requeued: true }, false).kind, 'unknown');
  assert.equal(interpretNotificationRetry(200, { notificationId: 'n1', requeued: false }, false).kind, 'unknown');
});
