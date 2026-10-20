import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STAFF_ACCOUNT_HREF,
  STAFF_ACCOUNT_SEGMENT,
} from './staff-account-route.ts';

test('staff account route is root stack outside NativeTabs', () => {
  assert.equal(STAFF_ACCOUNT_SEGMENT, 'staff-account');
  assert.equal(STAFF_ACCOUNT_HREF, '/staff-account');
  assert.doesNotMatch(STAFF_ACCOUNT_HREF, /\(tabs\)/);
  assert.doesNotMatch(STAFF_ACCOUNT_HREF, /^\/account$/);
});
