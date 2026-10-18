import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkRequestOrigin,
  sanitizePostLoginPath,
  sessionCookieOptions,
  SESSION_COOKIES,
  PLATFORM_SESSION_COOKIES,
} from '@ticket/web-session';

const portal = {
  NODE_ENV: 'production',
  WEB_PUBLIC_ORIGIN: 'https://portal.vemoki.com',
  AUTH_COOKIE_SECURE: 'true',
};

function request(origin: string | null, method = 'POST') {
  return {
    method,
    url: 'http://127.0.0.1:3013/api/bff/me/tenants',
    headers: new Headers(origin ? { origin } : {}),
  };
}

test('portal origin adapter rejects app./marketing siblings fail-closed', () => {
  assert.equal(
    checkRequestOrigin(request('https://portal.vemoki.com'), portal),
    null,
  );
  for (const origin of [
    'https://app.vemoki.com',
    'https://vemoki.com',
    null,
  ]) {
    const v = checkRequestOrigin(request(origin), portal);
    assert.ok(v);
    assert.equal(v.status, 403);
  }
});

test('cookie options stay host-only HttpOnly Secure under AUTH_COOKIE_SECURE', () => {
  const opts = sessionCookieOptions(120, portal);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.secure, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(Object.hasOwn(opts, 'domain'), false);
  assert.equal(SESSION_COOKIES.access, 'oidc_access_token');
  assert.equal(PLATFORM_SESSION_COOKIES.access, 'platform_oidc_access');
  assert.notEqual(SESSION_COOKIES.access, PLATFORM_SESSION_COOKIES.access);
});

test('return path allowlist drops /gate and open redirects — portal prefixes only', () => {
  assert.equal(sanitizePostLoginPath('/tenants/abc'), '/tenants/abc');
  assert.equal(sanitizePostLoginPath('/admin?x=1'), '/admin');
  assert.equal(sanitizePostLoginPath('/gate'), null);
  assert.equal(sanitizePostLoginPath('//evil.test'), null);
  assert.equal(sanitizePostLoginPath('/admin/../gate'), null);
});

test('portal app prefixes extend package helper for /t and /account', async () => {
  const { sanitizePortalReturnPath } = await import('../src/oidc/return-path');
  assert.equal(sanitizePortalReturnPath('/t/abc/events'), '/t/abc/events');
  assert.equal(
    sanitizePortalReturnPath('/account/security'),
    '/account/security',
  );
  assert.equal(sanitizePortalReturnPath('/gate'), null);
});
