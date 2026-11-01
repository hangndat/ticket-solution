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
  });

  it('keeps canonical www redirect when Host is www', () => {
    const response = proxy(request('www.vemoki.com', '/en', 'app.vemoki.com'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://vemoki.com/en');
  });
});
