import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import proxy from '../proxy';

function request(host: string, path: string, forwardedHost: string): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: {
      host,
      'x-forwarded-host': forwardedHost,
      forwarded: `host=${forwardedHost}`,
    },
  });
}

describe('proxy host routing', () => {
  it('keeps product Host on product when forwarding claims www', () => {
    const response = proxy(request('app.vemoki.com', '/', 'www.vemoki.com'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  });

  it('routes marketing Host to product even when forwarding claims app', () => {
    const response = proxy(request('vemoki.com', '/auth', 'app.vemoki.com'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://app.vemoki.com/auth');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });

  it('keeps canonical www redirect when Host is www', () => {
    const response = proxy(request('www.vemoki.com', '/en', 'app.vemoki.com'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://vemoki.com/en');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });

  it('keeps portal and retired gate redirects out of shared caches', () => {
    const previous = process.env.PORTAL_ORIGIN;
    process.env.PORTAL_ORIGIN = 'https://portal.vemoki.com';
    try {
      const portal = proxy(request('app.vemoki.com', '/admin', 'vemoki.com'));
      const gate = proxy(request('app.vemoki.com', '/gate', 'vemoki.com'));
      assert.equal(portal.status, 302);
      assert.equal(portal.headers.get('cache-control'), 'private, no-store');
      assert.equal(gate.status, 308);
      assert.equal(gate.headers.get('cache-control'), 'private, no-store');
    } finally {
      if (previous === undefined) delete process.env.PORTAL_ORIGIN;
      else process.env.PORTAL_ORIGIN = previous;
    }
  });
});
