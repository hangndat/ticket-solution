import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionCookieOptions } from '../src/oidc/cookies';

test('session cookies default Secure in production', () => {
  assert.equal(sessionCookieOptions(300, { NODE_ENV: 'production' }).secure, true);
  assert.equal(
    sessionCookieOptions(300, { NODE_ENV: 'development' }).secure,
    false,
  );
  assert.equal(
    sessionCookieOptions(300, {
      NODE_ENV: 'development',
      AUTH_COOKIE_SECURE: 'true',
    }).secure,
    true,
  );
});
