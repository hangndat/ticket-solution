const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createApp } = require('../dist/app');
const {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} = require('../dist/http-limits');

test('GET offline-sync receipt uses a dedicated rate bucket from POST replay', () => {
  assert.notEqual(
    API_RATE_BUCKETS.gateOfflineSyncReceipt,
    API_RATE_BUCKETS.gateOfflineSync,
  );
  assert.equal(API_RATE_LIMITS.gateOfflineSyncPerUser, 60);
  assert.equal(API_RATE_LIMITS.gateOfflineSyncReceiptPerUser, 240);
  const gateJs = readFileSync(join(__dirname, '../dist/gate.js'), 'utf8');
  assert.match(
    gateJs,
    /offlineSyncReceipt[\s\S]{0,800}gateOfflineSyncReceipt/,
  );
  assert.match(
    gateJs,
    /async offlineSync\([\s\S]{0,800}gateOfflineSync/,
  );
});

test('GET offline-sync receipt rejects invalid UUIDs with 422', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const base =
      '/v1/gate/events/00000000-0000-4000-8000-000000000001/offline-sync/receipts/00000000-0000-4000-8000-000000000002';
    const badTenant = await app.inject({
      method: 'GET',
      url: `${base}?tenantId=not-a-uuid`,
    });
    assert.equal(badTenant.statusCode, 422);
    assert.equal(badTenant.json().code, 'SCOPE_REQUIRED');

    const badEvent = await app.inject({
      method: 'GET',
      url:
        '/v1/gate/events/not-a-uuid/offline-sync/receipts/00000000-0000-4000-8000-000000000002?tenantId=00000000-0000-4000-8000-000000000003',
    });
    assert.equal(badEvent.statusCode, 422);

    const missingTenant = await app.inject({
      method: 'GET',
      url:
        '/v1/gate/events/00000000-0000-4000-8000-000000000001/offline-sync/receipts/00000000-0000-4000-8000-000000000002',
    });
    assert.equal(missingTenant.statusCode, 422);
    assert.equal(missingTenant.json().code, 'SCOPE_REQUIRED');
  } finally {
    await app.close();
  }
});
