import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withPrivateNoStore } from '../src/bff/cache-control';

describe('withPrivateNoStore', () => {
  it('overrides a cacheable upstream Cache-Control', () => {
    const upstream = new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
    const out = withPrivateNoStore(upstream);
    assert.equal(out.status, 200);
    assert.equal(out.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(out.headers.get('Content-Type'), 'application/json');
  });

  it('sets private, no-store when the response has no cache header', () => {
    const out = withPrivateNoStore(new Response('{}', { status: 401 }));
    assert.equal(out.status, 401);
    assert.equal(out.headers.get('Cache-Control'), 'private, no-store');
  });
});
