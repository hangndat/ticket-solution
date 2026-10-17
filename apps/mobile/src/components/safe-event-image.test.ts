import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remoteImageSource } from './safe-event-image-url.ts';

test('remoteImageSource accepts https URLs only', () => {
  assert.deepEqual(remoteImageSource('https://cdn.example/b.png'), {
    uri: 'https://cdn.example/b.png',
  });
  assert.deepEqual(remoteImageSource('http://127.0.0.1:9000/x.png'), {
    uri: 'http://127.0.0.1:9000/x.png',
  });
});

test('remoteImageSource rejects empty, relative, and non-http schemes', () => {
  assert.equal(remoteImageSource(null), null);
  assert.equal(remoteImageSource(undefined), null);
  assert.equal(remoteImageSource(''), null);
  assert.equal(remoteImageSource('   '), null);
  assert.equal(remoteImageSource('/assets/demo/banner.png'), null);
  assert.equal(remoteImageSource('javascript:alert(1)'), null);
  assert.equal(remoteImageSource('data:image/png;base64,xx'), null);
});
