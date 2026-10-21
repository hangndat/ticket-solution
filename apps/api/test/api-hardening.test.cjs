const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi } = require('../dist/app');
const { DEFAULT_JSON_BODY_LIMIT_BYTES } = require('../dist/http-limits');

test('default JSON bodyLimit rejects oversized payloads', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();
    const overDefault = 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 1);
    const reject = await app.inject({
      method: 'POST',
      url: '/v1/gate/events/00000000-0000-4000-8000-000000000001/reservations',
      payload: overDefault,
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(reject.statusCode, 413);
    assert.equal(
      fastify.initialConfig.bodyLimit,
      DEFAULT_JSON_BODY_LIMIT_BYTES,
    );
  } finally {
    await app.close();
  }
});

test('invalid UUID path and limit query return 422 not 500', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const badRedeem = await app.inject({
      method: 'POST',
      url: '/v1/tenants/not-a-uuid/events/00000000-0000-4000-8000-000000000002/redemptions',
      payload: { code: 'ABC' },
    });
    assert.equal(badRedeem.statusCode, 422);
    assert.equal(badRedeem.json().code, 'INVALID_UUID');

    const badLimit = await app.inject({
      method: 'GET',
      url: '/v1/public/events?limit=1.5',
    });
    assert.equal(badLimit.statusCode, 422);
    assert.equal(badLimit.json().code, 'INVALID_LIMIT');

    const badPlatformLimit = await app.inject({
      method: 'GET',
      url: '/v1/platform/tenants?limit=-3',
    });
    assert.equal(badPlatformLimit.statusCode, 422);
  } finally {
    await app.close();
  }
});

test('OpenAPI documents optional cursor/limit on GET /v1/public/events', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    const doc = createOpenApi(app);
    const params = doc.paths['/v1/public/events'].get.parameters;
    const byName = Object.fromEntries(params.map((p) => [p.name, p]));
    assert.equal(byName.cursor.required, false);
    assert.equal(byName.limit.required, false);
    assert.equal(byName.limit.schema.type, 'number');
    assert.equal(byName.limit.schema.minimum, 1);
    assert.equal(byName.limit.schema.maximum, 100);
  } finally {
    await app.close();
  }
});

test('issue boot misconfig does not echo env variable names', async () => {
  const { resolveIssueDeps } = require('../dist/tickets');
  const deps = resolveIssueDeps({});
  assert.match(deps.issueBootError?.message ?? '', /not configured/i);
  assert.doesNotMatch(deps.issueBootError?.message ?? '', /CODE_HMAC_PEPPER/);
});
