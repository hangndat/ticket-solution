import assert from 'node:assert/strict';
import test from 'node:test';
import { passthroughUpstream } from '../src/bff/upstream';

test('BFF forwards upstream Retry-After without changing the response status or cache policy', async () => {
  const upstream = new Response('{"retryable":true}', {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '3' },
  });
  const result = passthroughUpstream(upstream, await upstream.arrayBuffer());
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('Retry-After'), '3');
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await result.json(), { retryable: true });
});
