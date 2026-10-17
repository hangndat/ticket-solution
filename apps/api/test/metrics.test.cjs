const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app');
const { metricsBearerMatches } = require('../dist/metrics');

test('metricsBearerMatches is length-safe and accepts exact Bearer', () => {
  const token = 'metrics-test-token-not-a-secret-log';
  assert.equal(metricsBearerMatches('Bearer ' + token, token), true);
  assert.equal(metricsBearerMatches('Bearer wrong', token), false);
  assert.equal(metricsBearerMatches('Bearer ' + token + 'x', token), false);
  assert.equal(metricsBearerMatches(undefined, token), false);
  assert.equal(metricsBearerMatches('Basic x', token), false);
});

test('GET /metrics auth, cardinality labels, production disabled', async () => {
  const token = 'metrics-test-token-not-a-secret-log';
  const app = await createApp({
    logging: false,
    env: { NODE_ENV: 'development', METRICS_TOKEN: token },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    assert.equal(
      (await app.inject({ method: 'GET', url: '/metrics' })).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: '/metrics',
          headers: { authorization: 'Bearer wrong' },
        })
      ).statusCode,
      401,
    );

    // Generate a labeled observation via health
    await app.inject({ method: 'GET', url: '/v1/health' });
    const ok = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(ok.statusCode, 200);
    assert.match(ok.headers['content-type'], /text\/plain/);
    const body = ok.body;
    assert.match(body, /http_request_duration_seconds/);
    assert.match(body, /route_template=/);
    assert.match(body, /status_class=/);
    assert.doesNotMatch(body, /attendee@/);
    assert.doesNotMatch(body, /Bearer /);
    // Low cardinality: template not raw uuid path for health
    assert.match(body, /\/v1\/health|route_template="\/v1\/health"/);
  } finally {
    await app.close();
  }
});

test('GET /metrics production without token returns 404', async () => {
  const app = await createApp({
    logging: false,
    env: { NODE_ENV: 'production' },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});
