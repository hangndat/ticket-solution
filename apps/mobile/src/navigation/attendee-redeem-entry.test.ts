import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTENDEE_REDEEM_PATH,
  normalizeAttendeeRedeemPath,
} from './attendee-redeem-entry.ts';

test('scoped redeem path canonicalizes to global attendee entry', () => {
  assert.equal(ATTENDEE_REDEEM_PATH, '/redeem-global');
  assert.equal(normalizeAttendeeRedeemPath('/redeem'), '/redeem-global');
  assert.equal(normalizeAttendeeRedeemPath('/redeem-global'), '/redeem-global');
  assert.equal(normalizeAttendeeRedeemPath('/claim'), '/claim');
});
