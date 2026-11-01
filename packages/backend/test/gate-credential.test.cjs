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
