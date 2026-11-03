const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, readCorsOrigins } = require('../dist/app');

test('CORS configuration is explicit and rejects non-canonical origins', async () => {
  assert.deepEqual(readCorsOrigins(undefined), []);
  assert.deepEqual(
    readCorsOrigins('http://localhost:3000, https://app.example.test'),
    ['http://localhost:3000', 'https://app.example.test'],
  );
  for (const value of [
    '*',
    'https://*.example.test',
    'null',
    'https://example.test/',
    'https://user@example.test',
    'https://example.test,',
    'file:///tmp',
  ]) {
    assert.throws(() => readCorsOrigins(value), /Invalid API_CORS_ORIGINS/);
  }
  const app = await createApp({ logging: false, env: {} });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'http://localhost:3000' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  } finally {
    await app.close();
  }
});
