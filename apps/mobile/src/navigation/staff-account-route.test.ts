import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STAFF_ACCOUNT_HREF,
  STAFF_ACCOUNT_SEGMENT,
} from './staff-account-route.ts';

test('staff account route is a unique tab segment (not root /account)', () => {
  assert.equal(STAFF_ACCOUNT_SEGMENT, 'staff-account');
  assert.match(STAFF_ACCOUNT_HREF, /staff-account$/);
  assert.doesNotMatch(STAFF_ACCOUNT_HREF, /^\/account$/);
});
