const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createApnsAdapter,
  requireApnsConfig,
  DEVICE_TOKEN_ERROR_CODES,
} = require('../dist');

test('APNs adapter fail-closed when env missing', async () => {
  assert.throws(
    () => requireApnsConfig({}),
    (e) => e.code === DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
  );
  const adapter = createApnsAdapter({});
  await assert.rejects(
    () =>
      adapter.send({
        deviceToken: 'a'.repeat(64),
        environment: 'sandbox',
        title: 't',
        body: 'b',
      }),
    (e) => e.code === DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
  );
});
