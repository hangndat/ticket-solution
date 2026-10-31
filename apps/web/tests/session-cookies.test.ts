import assert from 'node:assert/strict';
import test from 'node:test';
import { accessTokenMatchesSubject, sessionCookieOptions } from '../src/oidc/cookies';

test('session cookies default Secure in production', () => {
  assert.equal(
    sessionCookieOptions(300, { NODE_ENV: 'production' as const }).secure,
    true,
  );
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

test('a late refresh token cannot authenticate without the callback subject anchor', () => {
  const payload = Buffer.from(JSON.stringify({ sub: 'actor-before-logout' })).toString('base64url');
  const token = `eyJhbGciOiJub25lIn0.${payload}.signature`;
  assert.equal(accessTokenMatchesSubject(token, null), false);
  assert.equal(accessTokenMatchesSubject(token, 'actor-after-login'), false);
  assert.equal(accessTokenMatchesSubject(token, 'actor-before-logout'), true);
  assert.equal(accessTokenMatchesSubject('malformed', 'actor-before-logout'), false);
});
