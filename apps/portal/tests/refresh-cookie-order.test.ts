import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { SESSION_COOKIES } from '@ticket/web-session';
import { PORTAL_AUTH_COOKIES, staffTokenCookieName } from '../src/oidc/local-cookies';

const epochA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const epochB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('late staff refresh writes only A token names after B callback', async () => {
  const jar = new Map<string, string>([
    [PORTAL_AUTH_COOKIES.epoch, epochB],
    [PORTAL_AUTH_COOKIES.subject, 'staff-b'],
    [staffTokenCookieName(SESSION_COOKIES.access, epochB), 'access-b'],
    [staffTokenCookieName(SESSION_COOKIES.refresh, epochB), 'refresh-b'],
  ]);
  mock.module('next/headers', {
    namedExports: {
      cookies: async () => ({
        get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
        set: (name: string, value: string) => { jar.set(name, value); },
      }),
    },
  });
  const { applyStaffGrant } = await import('../src/oidc/refresh.ts');

  await applyStaffGrant({
    accessToken: 'access-a-late',
    refreshToken: 'refresh-a-late',
    subject: 'staff-a',
    expiresIn: 300,
  }, epochA);

  assert.equal(jar.get(PORTAL_AUTH_COOKIES.epoch), epochB);
  assert.equal(jar.get(PORTAL_AUTH_COOKIES.subject), 'staff-b');
  assert.equal(jar.get(staffTokenCookieName(SESSION_COOKIES.access, epochB)), 'access-b');
  assert.equal(jar.get(staffTokenCookieName(SESSION_COOKIES.refresh, epochB)), 'refresh-b');
  assert.equal(jar.get(staffTokenCookieName(SESSION_COOKIES.access, epochA)), 'access-a-late');

  const { readStaffAccessToken } = await import('../src/oidc/cookies.ts');
  assert.equal(await readStaffAccessToken(), 'access-b');
  jar.set(PORTAL_AUTH_COOKIES.epoch, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  assert.equal(await readStaffAccessToken(), null, 'logout epoch cannot read late A token');
  mock.reset();
});
