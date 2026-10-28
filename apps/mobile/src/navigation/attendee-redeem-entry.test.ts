import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTENDEE_REDEEM_PATH,
  attendeeRedeemHref,
  extractRedeemCodeFromLinkInput,
  normalizeAttendeeRedeemPath,
  sanitizeRedeemCodeParam,
} from './attendee-redeem-entry.ts';

test('scoped redeem path canonicalizes to global attendee entry', () => {
  assert.equal(ATTENDEE_REDEEM_PATH, '/(tabs)/redeem');
  assert.equal(normalizeAttendeeRedeemPath('/redeem'), '/(tabs)/redeem');
  assert.equal(normalizeAttendeeRedeemPath('/redeem-global'), '/(tabs)/redeem');
  assert.equal(normalizeAttendeeRedeemPath('/claim'), '/claim');
});

test('redeem code query is sanitized and preserved on global href', () => {
  const code = 'GIFT-2026-ABCD';
  assert.equal(sanitizeRedeemCodeParam(`  ${code}  `), code);
  assert.equal(sanitizeRedeemCodeParam(''), null);
  assert.equal(sanitizeRedeemCodeParam('x'.repeat(129)), null);
  assert.equal(
    extractRedeemCodeFromLinkInput(`vemoki://redeem?code=${code}`),
    code,
  );
  assert.equal(
    attendeeRedeemHref(code),
    `/(tabs)/redeem?code=${encodeURIComponent(code)}`,
  );
});
