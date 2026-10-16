import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PUSH_NOT_CONFIGURED,
  PushDeliveryRefused,
  acceptDeliveredClaim,
  pushProviderName,
  pushUiCopy,
  sendPush,
} from './push.ts';

test('missing or blank provider is not configured', () => {
  assert.equal(pushProviderName({}), null);
  assert.equal(pushProviderName({ EXPO_PUBLIC_PUSH_PROVIDER: '   ' }), null);
  assert.equal(pushUiCopy(null).title, PUSH_NOT_CONFIGURED);
});

test('unconfigured push refuses a delivered state', () => {
  const provider = pushProviderName({});
  const sent = sendPush(
    { id: 'note-1', title: 'Event reminder', body: 'Doors open' },
    provider,
  );
  assert.equal(sent.delivered, false);
  assert.equal(sent.status, 'not-configured');
  assert.equal(sent.message, PUSH_NOT_CONFIGURED);

  const forged = { delivered: true };
  assert.throws(
    () => acceptDeliveredClaim(forged, provider),
    (error: unknown) => {
      assert.ok(error instanceof PushDeliveryRefused);
      assert.equal(error.delivered, false);
      assert.equal(error.status, 'not-configured');
      assert.equal(error.message, PUSH_NOT_CONFIGURED);
      return true;
    },
  );
  assert.equal(forged.delivered, true);

  const quiet = acceptDeliveredClaim({ delivered: false }, null);
  assert.equal(quiet.delivered, false);
  assert.equal(quiet.status, 'not-configured');
});

test('a named provider still cannot be marked delivered', () => {
  const sent = sendPush(
    { id: 'note-2', title: 'Ticket', body: 'Issued' },
    'apns',
  );
  assert.equal(sent.delivered, false);
  assert.equal(sent.status, 'transport-unavailable');
  assert.throws(
    () => acceptDeliveredClaim({ delivered: true }, 'apns'),
    (error: unknown) => {
      assert.ok(error instanceof PushDeliveryRefused);
      assert.equal(error.delivered, false);
      return true;
    },
  );
});
