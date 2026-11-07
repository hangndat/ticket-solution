import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUEST_HOME_HREF } from '../navigation/attendee-account-route.ts';
import { globalRedeemErrorExitHref } from './global-redeem-presentation.ts';

test('redeem lookup error exit returns to Events for both identities', () => {
  assert.equal(globalRedeemErrorExitHref('guest'), GUEST_HOME_HREF);
  assert.equal(globalRedeemErrorExitHref('verified'), GUEST_HOME_HREF);
});
