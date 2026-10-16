const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi, readApiEnvironment } = require('../dist/app');
test('Fastify liveness matches contract; no business route', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
    });
    assert.equal(
      (await app.inject({ method: 'GET', url: '/v1/events' })).statusCode,
      404,
    );
    const doc = createOpenApi(app);
    assert.deepEqual(Object.keys(doc.paths), ['/v1/health']);
    assert.equal(
      doc.components.schemas.HealthDto.properties.status.enum[0],
      'ok',
    );
  } finally {
    await app.close();
  }
});
test('invalid environment fails with no secret reflection', () => {
  for (const PORT of ['0', '65536', '3e3', 'secret'])
    assert.throws(() => readApiEnvironment({ PORT }));
  assert.throws(() => readApiEnvironment({ NODE_ENV: 'preview' }));
  assert.equal(readApiEnvironment({}).port, 3001);
});

test('listening Fastify API closes cleanly', async () => {
  const app = await createApp(false);
  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpAdapter().getInstance().server.address();
    const response = await fetch(
      'http://127.0.0.1:' + address.port + '/v1/health',
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, 'api');
  } finally {
    await app.close();
  }
  assert.equal(app.getHttpAdapter().getInstance().server.listening, false);
});
