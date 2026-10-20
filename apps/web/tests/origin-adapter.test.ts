import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRequestOrigin } from '@ticket/web-session';

const appProd = {
  NODE_ENV: 'production',
  WEB_PUBLIC_ORIGIN: 'https://app.vemoki.com',
};

function request(origin: string | null, method = 'POST') {
  return {
    method,
    url: 'http://127.0.0.1:3000/api/bff/admin/events',
    headers: new Headers(origin ? { origin } : {}),
  };
}

test('web-session rejects sibling origins and missing Origin on mutations', () => {
  assert.equal(
    checkRequestOrigin(request('https://app.vemoki.com'), appProd),
    null,
  );
  for (const origin of ['https://portal.vemoki.com', 'https://vemoki.com', null]) {
    const v = checkRequestOrigin(request(origin), appProd);
    assert.ok(v);
    assert.equal(v!.status, 403);
  }
});

test('forwarded headers cannot satisfy origin when WEB_PUBLIC_ORIGIN missing in prod', () => {
  const req = {
    method: 'POST',
    url: 'http://127.0.0.1:3000/api/bff/admin/events',
    headers: new Headers({
      origin: 'https://evil.test',
      'x-forwarded-host': 'evil.test',
      'x-forwarded-proto': 'https',
    }),
  };
  assert.equal(checkRequestOrigin(req, { NODE_ENV: 'production' })?.code, 'ORIGIN_NOT_CONFIGURED');
});
