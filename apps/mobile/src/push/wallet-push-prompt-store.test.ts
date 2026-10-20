import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldOfferWalletPushPrompt } from './wallet-push-prompt-policy.ts';

test('wallet prompt only on first ticket when eligible', () => {
  assert.equal(
    shouldOfferWalletPushPrompt({
      ticketCount: 1,
      dismissed: false,
      providerIsApns: true,
      identityVerified: true,
      iosPermissionAuthorized: false,
    }),
    true,
  );
  assert.equal(
    shouldOfferWalletPushPrompt({
      ticketCount: 1,
      dismissed: true,
      providerIsApns: true,
      identityVerified: true,
      iosPermissionAuthorized: false,
    }),
    false,
  );
  assert.equal(
    shouldOfferWalletPushPrompt({
      ticketCount: 0,
      dismissed: false,
      providerIsApns: true,
      identityVerified: true,
      iosPermissionAuthorized: false,
    }),
    false,
  );
});
