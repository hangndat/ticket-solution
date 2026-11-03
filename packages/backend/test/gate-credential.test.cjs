'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const backend = require('../dist');

function keyPair(kid) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    kid,
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
    publicKeyJwk: pair.publicKey.export({ format: 'jwk' }),
  };
}

function keyringEntry(pair, format) {
  return {
    kid: pair.kid,
    alg: 'ES256',
    [format]: format === 'publicKeyJwk' ? pair.publicKeyJwk : pair.publicKeyPem,
  };
}

test('manual codes remain readable across credential key rotation and reject unknown kids', () => {
  const oldMaterial = 'manual-code-old-test-key-material';
  const currentMaterial = 'manual-code-current-test-key-material';
  const legacy = backend.sealManualEntryCode('ABCD-EFGH-JK', oldMaterial);
  const oldRing = { currentKid: 'manual-v1', keys: { 'manual-v1': oldMaterial } };
  const versioned = backend.sealManualEntryCode('MNPQ-RSTV-WX', oldRing);
  const rotated = {
    currentKid: 'manual-v2',
    keys: { 'local-v1': oldMaterial, 'manual-v1': oldMaterial, 'manual-v2': currentMaterial },
  };
  assert.equal(backend.openManualEntryCode(legacy, oldMaterial), 'ABCD-EFGH-JK');
  assert.equal(backend.openManualEntryCode(legacy, rotated), 'ABCD-EFGH-JK');
  assert.equal(backend.openManualEntryCode(versioned, rotated), 'MNPQ-RSTV-WX');
  const fresh = backend.sealManualEntryCode('0123-4567-89', rotated);
  assert.ok(fresh.startsWith('manual-v2:'));
  assert.equal(backend.openManualEntryCode(fresh, rotated), '0123-4567-89');
  assert.throws(() => backend.openManualEntryCode(versioned, { currentKid: 'manual-v2', keys: { 'manual-v2': currentMaterial } }));
  assert.throws(() => backend.openManualEntryCode(fresh.replace('manual-v2:', 'unknown:'), rotated));
  assert.throws(() => backend.openCredentialToken(fresh.split(':')[1], rotated, 'manual-v2'));
});

test('gate verify keyring accepts public PEM and JWK and retains older signing kids', async () => {
  const old = keyPair('gate-old');
  const current = keyPair('gate-current');
  const credentialKeyMaterial = 'gate-test-credential-key-material';
  const env = {
    GATE_CREDENTIAL_CURRENT_KEY_ID: current.kid,
    GATE_CREDENTIAL_SIGNING_KEY_SEALED: backend.sealCredentialToken(
      current.privateKeyPem,
      backend.deriveGateSigningSealKey(credentialKeyMaterial),
    ).encryptedToken,
    GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([
      keyringEntry(current, 'publicKeyPem'),
      keyringEntry(old, 'publicKeyJwk'),
    ]),
    GATE_MANUAL_CODE_PEPPER: 'gate-test-only-pepper-with-at-least-32-bytes',
  };

  const config = await backend.readGateCredentialConfig(env, credentialKeyMaterial);
  const rotatedStorageKeys = {
    currentKid: 'storage-v2',
    keys: { 'storage-v1': credentialKeyMaterial, 'storage-v2': 'new-gate-test-storage-key-material' },
  };
  const afterRotation = await backend.readGateCredentialConfig(env, rotatedStorageKeys);
  assert.equal(afterRotation.signingPrivateKeyPem, config.signingPrivateKeyPem);
  await assert.rejects(backend.readGateCredentialConfig(env, {
    currentKid: 'storage-v2', keys: { 'storage-v2': 'new-gate-test-storage-key-material' },
  }));
  await assert.rejects(backend.readGateCredentialConfig(env, {
    currentKid: 'unknown', keys: { 'storage-v1': credentialKeyMaterial },
  }));
  const currentJws = await backend.signGateCredentialJws({
    claims: { tid: 'tenant', eid: 'event', tkt: 'ticket', ver: 1 },
    privateKeyPem: config.signingPrivateKeyPem,
    kid: config.currentKeyId,
  });
  assert.equal((await backend.verifyGateCredentialJws(currentJws, config.verifyKeys)).tkt, 'ticket');

  const oldJws = await backend.signGateCredentialJws({
    claims: { tid: 'tenant', eid: 'event', tkt: 'old-ticket', ver: 1 },
    privateKeyPem: old.privateKeyPem,
    kid: old.kid,
  });
  assert.equal((await backend.verifyGateCredentialJws(oldJws, config.verifyKeys)).tkt, 'old-ticket');
});

test('email signing config validates the current key pair without requiring manual-code pepper', async () => {
  const current = keyPair('gate-email-current');
  const credentialKeyMaterial = 'gate-email-test-credential-key-material';
  const env = {
    GATE_CREDENTIAL_CURRENT_KEY_ID: current.kid,
    GATE_CREDENTIAL_SIGNING_KEY_SEALED: backend.sealCredentialToken(
      current.privateKeyPem,
      backend.deriveGateSigningSealKey(credentialKeyMaterial),
    ).encryptedToken,
    GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([
      keyringEntry(current, 'publicKeyJwk'),
    ]),
  };

  const config = await backend.readGateCredentialSigningConfig(env, credentialKeyMaterial);
  const jws = await backend.signGateCredentialJws({
    claims: { tid: 'tenant', eid: 'event', tkt: 'email-ticket', ver: 7 },
    privateKeyPem: config.signingPrivateKeyPem,
    kid: config.currentKeyId,
  });
  const claims = await backend.verifyGateCredentialJws(jws, config.verifyKeys);
  assert.equal(claims.tkt, 'email-ticket');
  assert.equal(claims.ver, 7);

  const mismatched = keyPair('gate-email-mismatch');
  await assert.rejects(
    backend.readGateCredentialSigningConfig(
      {
        ...env,
        GATE_CREDENTIAL_SIGNING_KEY_SEALED: backend.sealCredentialToken(
          mismatched.privateKeyPem,
          backend.deriveGateSigningSealKey(credentialKeyMaterial),
        ).encryptedToken,
      },
      credentialKeyMaterial,
    ),
    (error) => error.code === backend.GATE_ERROR_CODES.CREDENTIAL_SIGNATURE_INVALID,
  );

  await assert.rejects(
    backend.readGateCredentialSigningConfig({}, credentialKeyMaterial),
    (error) => error.code === backend.GATE_ERROR_CODES.CREDENTIAL_SIGNATURE_INVALID,
  );
});

test('gate verify keyring rejects private PEM and private JWK material', async () => {
  const pair = keyPair('gate-private');
  const privateJwk = { ...pair.publicKeyJwk };
  privateJwk.d = 'not-a-real-private-scalar';

  for (const entry of [
    { kid: pair.kid, alg: 'ES256', publicKeyPem: pair.privateKeyPem },
    { kid: pair.kid, alg: 'ES256', publicKeyJwk: privateJwk },
    {
      kid: pair.kid,
      alg: 'ES256',
      publicKeyPem: pair.publicKeyPem,
      publicKeyJwk: privateJwk,
    },
  ]) {
    await assert.rejects(
      backend.readGateCredentialVerifyKeys({ GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([entry]) }),
      (error) => error.code === backend.GATE_ERROR_CODES.CREDENTIAL_SIGNATURE_INVALID,
    );
  }
});
