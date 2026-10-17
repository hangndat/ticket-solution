const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  createApnsAdapter,
  requireApnsConfig,
  isApnsEnabled,
  readApnsEnvironment,
  readApnsPrivateKeyPem,
  providerStatusFromDbState,
  DEVICE_TOKEN_ERROR_CODES,
} = require('../dist');

function sampleP8() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

test('APNs disabled by default; enabled without key fail-closed', async () => {
  assert.equal(isApnsEnabled({}), false);
  assert.equal(isApnsEnabled({ APNS_ENABLED: 'false' }), false);
  assert.equal(isApnsEnabled({ APNS_ENABLED: 'true' }), true);

  assert.throws(
    () => requireApnsConfig({}),
    (e) => e.code === DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
  );
  assert.throws(
    () =>
      requireApnsConfig({
        APNS_ENABLED: 'true',
        APNS_KEY_ID: 'ABC123',
        APNS_TEAM_ID: 'BLUA62D52G',
        APNS_BUNDLE_ID: 'com.hangndat.ticket',
      }),
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

test('APNs reads AuthKey from APNS_KEY_PATH when enabled', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apns-key-'));
  const keyPath = join(dir, 'AuthKey.p8');
  try {
    writeFileSync(keyPath, sampleP8(), 'utf8');
    const env = {
      APNS_ENABLED: 'true',
      APNS_KEY_ID: 'KEYID01',
      APNS_TEAM_ID: 'BLUA62D52G',
      APNS_BUNDLE_ID: 'com.hangndat.ticket',
      APNS_KEY_PATH: keyPath,
    };
    assert.ok(readApnsPrivateKeyPem(env)?.includes('PRIVATE KEY'));
    const cfg = requireApnsConfig(env);
    assert.equal(cfg.teamId, 'BLUA62D52G');
    assert.equal(cfg.bundleId, 'com.hangndat.ticket');
    assert.ok(readApnsEnvironment(env));
    // Construction validates when enabled.
    createApnsAdapter(env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('providerStatus ACCEPTED never means DELIVERED', () => {
  assert.equal(providerStatusFromDbState('SENT'), 'ACCEPTED');
  assert.equal(providerStatusFromDbState('ACCEPTED'), 'ACCEPTED');
  assert.equal(providerStatusFromDbState('PENDING'), 'PENDING');
  assert.equal(providerStatusFromDbState('FAILED'), 'FAILED');
  assert.equal(providerStatusFromDbState('DEAD'), 'DEAD');
  // No DELIVERED in honest ProviderStatus vocabulary (ADR-12).
  assert.equal(providerStatusFromDbState('DELIVERED'), 'PENDING');
  assert.notEqual(providerStatusFromDbState('SENT'), 'DELIVERED');
});
