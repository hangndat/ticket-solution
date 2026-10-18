import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLATFORM_SESSION_COOKIES,
  SESSION_COOKIES,
} from '@ticket/web-session';

test('staff and platform cookie jars are disjoint by name', () => {
  const staff = new Set<string>(Object.values(SESSION_COOKIES));
  const platform = Object.values(PLATFORM_SESSION_COOKIES);
  for (const name of platform) {
    assert.equal(staff.has(name), false, name);
  }
  assert.ok(SESSION_COOKIES.refresh);
  assert.ok(PLATFORM_SESSION_COOKIES.refresh);
  assert.notEqual(SESSION_COOKIES.refresh, PLATFORM_SESSION_COOKIES.refresh);
});

test('logout semantics map: staff logout must not list platform cookie names', () => {
  const staffLogoutClears = [
    SESSION_COOKIES.access,
    SESSION_COOKIES.refresh,
    SESSION_COOKIES.idToken,
    SESSION_COOKIES.pkce,
    SESSION_COOKIES.state,
    SESSION_COOKIES.returnPath,
  ];
  for (const name of staffLogoutClears) {
    assert.equal(
      Object.values(PLATFORM_SESSION_COOKIES).includes(name as never),
      false,
    );
  }
});
