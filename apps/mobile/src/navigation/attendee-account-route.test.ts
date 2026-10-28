import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTENDEE_ACCOUNT_HREF,
  ATTENDEE_ACCOUNT_SEGMENT,
  LEGACY_ATTENDEE_ACCOUNT_HREF,
} from './attendee-account-route.ts';

test('attendee account route is root stack outside NativeTabs', () => {
  assert.equal(ATTENDEE_ACCOUNT_SEGMENT, 'attendee-account');
  assert.equal(ATTENDEE_ACCOUNT_HREF, '/attendee-account');
  assert.doesNotMatch(ATTENDEE_ACCOUNT_HREF, /\(tabs\)/);
  assert.notEqual(ATTENDEE_ACCOUNT_HREF, LEGACY_ATTENDEE_ACCOUNT_HREF);
  assert.equal(LEGACY_ATTENDEE_ACCOUNT_HREF, '/account');
});
