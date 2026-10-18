const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkRequestOrigin,
  resolvePublicOrigin,
  sessionCookieOptions,
  sanitizePostLoginPath,
} = require('../dist');
const portal = {
  NODE_ENV: 'production',
  WEB_PUBLIC_ORIGIN: 'https://portal.vemoki.com',
  AUTH_COOKIE_SECURE: 'true',
};
const request = (origin, method = 'POST', extra = {}) => ({
  method,
  url: 'http://127.0.0.1:3013/api/bff/admin/publish',
  headers: new Headers({ ...(origin ? { origin } : {}), ...extra }),
});

test('sibling app and marketing origins cannot mutate a portal cookie session', () => {
  assert.equal(
    checkRequestOrigin(request('https://portal.vemoki.com'), portal),
    null,
  );
  for (const origin of [
    'https://app.vemoki.com',
    'https://vemoki.com',
    'https://portal.vemoki.com.evil.test',
  ]) {
    assert.equal(checkRequestOrigin(request(origin), portal).status, 403);
  }
  assert.equal(
    checkRequestOrigin(request(null), portal).code,
    'CSRF_ORIGIN_REQUIRED',
  );
});
test('invalid/missing production configuration never trusts spoofed forwarding', () => {
  const req = request('https://evil.test', 'POST', {
    'x-forwarded-host': 'evil.test',
    'x-forwarded-proto': 'https',
  });
  for (const env of [
    { NODE_ENV: 'production' },
    { WEB_PUBLIC_ORIGIN: 'broken' },
    { WEB_PUBLIC_ORIGIN: 'https://portal.vemoki.com,' },
  ]) {
    assert.equal(checkRequestOrigin(req, env).code, 'ORIGIN_NOT_CONFIGURED');
    assert.equal(resolvePublicOrigin(req, env), null);
  }
  assert.equal(resolvePublicOrigin(req, portal), 'https://portal.vemoki.com');
});
test('development loopback matching preserves ports and ignores forwarded headers', () => {
  const req = request('http://localhost:3013');
  assert.equal(checkRequestOrigin(req, {}), null);
  assert.equal(
    checkRequestOrigin(request('http://localhost:3000'), {}).status,
    403,
  );
  assert.equal(
    checkRequestOrigin(request('https://portal.vemoki.com', 'GET'), portal),
    null,
  );
});
test('cookie policy is host-only, HttpOnly, with configured TLS flag', () => {
  const options = sessionCookieOptions(123.9, portal);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.maxAge, 123);
  assert.equal(Object.hasOwn(options, 'domain'), false);
  assert.equal(
    sessionCookieOptions(60, { NODE_ENV: 'production' }).secure,
    true,
  );
  assert.throws(() => sessionCookieOptions(Infinity, portal));
});
test('post-login returns only allowlisted portal paths, without data-bearing query', () => {
  assert.equal(
    sanitizePostLoginPath('/tenants/abc/events/def?token=secret#x'),
    '/tenants/abc/events/def',
  );
  assert.equal(sanitizePostLoginPath('/platform'), '/platform');
  for (const path of [
    '//evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/%252f%252fevil',
    '/admin/../gate',
    '/admin/%2e%2e/gate',
    '/gate',
    '/adminish',
    'https://evil.test',
    '/admin\nLocation:evil',
  ]) {
    assert.equal(sanitizePostLoginPath(path), null, path);
  }
});
