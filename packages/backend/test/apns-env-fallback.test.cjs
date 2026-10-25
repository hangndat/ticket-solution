/**
 * APNs environment host fallback — mislabeled client sandbox/production.
 */
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const {
  sendApnsPush,
  setApnsHttp2ClientForTest,
  isApnsEnvFallbackEnabled,
} = require('../dist');

function sampleP8() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

const cfg = {
  keyId: 'KEYID01',
  teamId: 'BLUA62D52G',
  privateKeyPem: sampleP8(),
  bundleId: 'com.hangndat.ticket',
};

const baseInput = {
  deviceToken: 'a'.repeat(64),
  environment: 'sandbox',
  title: 't',
  body: 'b',
};

const enabledEnv = {
  APNS_ENABLED: 'true',
  APNS_KEY_ID: cfg.keyId,
  APNS_TEAM_ID: cfg.teamId,
  APNS_BUNDLE_ID: cfg.bundleId,
  APNS_KEY_P8: cfg.privateKeyPem,
};

afterEach(() => {
  setApnsHttp2ClientForTest(undefined);
});

test('APNS_ENV_FALLBACK defaults on; APNS_ENV_FALLBACK=0 disables', () => {
  assert.equal(isApnsEnvFallbackEnabled({}), true);
  assert.equal(isApnsEnvFallbackEnabled({ APNS_ENV_FALLBACK: '0' }), false);
  assert.equal(isApnsEnvFallbackEnabled({ APNS_ENV_FALLBACK: 'false' }), false);
});

test('sandbox label but production host accepts — ok and resolvedEnvironment production', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      if (environment === 'sandbox') {
        return {
          status: 400,
          body: JSON.stringify({ reason: 'BadDeviceToken' }),
          apnsId: 'id-sandbox',
        };
      }
      return { status: 200, body: '', apnsId: 'id-production' };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, true);
  assert.equal(result.resolvedEnvironment, 'production');
  assert.deepEqual(calls, ['sandbox', 'production']);
});

test('both hosts reject BadDeviceToken — invalidate like before', async () => {
  setApnsHttp2ClientForTest({
    async exchange() {
      return {
        status: 400,
        body: JSON.stringify({ reason: 'BadDeviceToken' }),
        apnsId: 'id-fail',
      };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, false);
  assert.equal(result.invalidateToken, true);
  assert.equal(result.retryable, false);
});

test('Unregistered on first host — no alternate host attempt', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      return {
        status: 410,
        body: JSON.stringify({ reason: 'Unregistered' }),
        apnsId: 'id-gone',
      };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, false);
  assert.equal(result.invalidateToken, true);
  assert.deepEqual(calls, ['sandbox']);
});

test('5xx on labeled host — retryable, no env fallback', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      return { status: 503, body: '', apnsId: 'id-503' };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.invalidateToken, false);
  assert.deepEqual(calls, ['sandbox']);
});

test('first host success — single push, no duplicate exchange', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      return { status: 200, body: '', apnsId: 'id-ok' };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, true);
  assert.equal(result.resolvedEnvironment, 'sandbox');
  assert.deepEqual(calls, ['sandbox']);
});

test('APNS_ENV_FALLBACK=0 — BadDeviceToken does not try production', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      return {
        status: 400,
        body: JSON.stringify({ reason: 'BadDeviceToken' }),
        apnsId: 'id-no-fallback',
      };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, {
    env: { ...enabledEnv, APNS_ENV_FALLBACK: '0' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.invalidateToken, true);
  assert.deepEqual(calls, ['sandbox']);
});

test('DeviceTokenNotForTopic triggers one alternate host attempt', async () => {
  const calls = [];
  setApnsHttp2ClientForTest({
    async exchange(environment) {
      calls.push(environment);
      if (environment === 'sandbox') {
        return {
          status: 400,
          body: JSON.stringify({ reason: 'DeviceTokenNotForTopic' }),
          apnsId: 'id-topic',
        };
      }
      return { status: 200, body: '', apnsId: 'id-prod' };
    },
  });

  const result = await sendApnsPush(cfg, baseInput, { env: enabledEnv });
  assert.equal(result.ok, true);
  assert.equal(result.resolvedEnvironment, 'production');
  assert.deepEqual(calls, ['sandbox', 'production']);
});

test('AR891-T3-F04: hanging HTTP/2 exchange is aborted at the provider deadline', async () => {
  let aborted = false;
  setApnsHttp2ClientForTest({
    exchange(_environment, request) {
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('transport aborted'));
        }, { once: true });
      });
    },
  });
  await assert.rejects(
    () => sendApnsPush(cfg, baseInput, { env: enabledEnv, timeoutMs: 25 }),
    /aborted|timeout/i,
  );
  assert.equal(aborted, true);
});

test('AR891-T3-F04: deadline resolves even if an injected transport ignores abort', async () => {
  setApnsHttp2ClientForTest({ exchange: () => new Promise(() => {}) });
  await assert.rejects(
    () => sendApnsPush(cfg, baseInput, { env: enabledEnv, timeoutMs: 25 }),
    /aborted|timeout/i,
  );
});
