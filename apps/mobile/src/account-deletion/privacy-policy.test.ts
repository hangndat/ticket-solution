import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRIVACY_POLICY_URL } from './privacy-policy.ts';

test('privacy opens marketing apex (O13 ASC), not product app. subdomain', () => {
  assert.equal(PRIVACY_POLICY_URL, 'https://vemoki.com/privacy');
  assert.doesNotMatch(PRIVACY_POLICY_URL, /app\.vemoki\.com/);
});
