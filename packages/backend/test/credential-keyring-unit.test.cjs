const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  readCredentialKeyringEnvironment,
  sealCredentialToken,
  openCredentialToken,
} = require('../dist/credential-crypto');
const { openCurrentCredentialForQr } = require('../dist/qr-ticket');

const OLD = 'test-old-key-material-at-least-16';
const NEW = 'test-new-key-material-at-least-16';

test('DB-19 QR keyring: old credential opens after rotation and unknown key fails closed', () => {
  const old = readCredentialKeyringEnvironment({ TICKET_CREDENTIAL_KEY: OLD });
  const credential = sealCredentialToken('opaque-token', old);
  assert.equal(credential.kid, 'local-v1');
  const rotated = readCredentialKeyringEnvironment({
    TICKET_CREDENTIAL_KEY: NEW,
    TICKET_CREDENTIAL_KID: 'local-v2',
    TICKET_CREDENTIAL_LEGACY_KEYS: JSON.stringify({ 'local-v1': OLD }),
  });
  assert.equal(
    openCredentialToken(credential.encryptedToken, rotated, credential.kid),
    'opaque-token',
  );
  assert.equal(sealCredentialToken('new-token', rotated).kid, 'local-v2');
  assert.throws(
    () => openCredentialToken(credential.encryptedToken, rotated, 'local-v3'),
    /unsupported credential key id/,
  );
  const removed = readCredentialKeyringEnvironment({
    TICKET_CREDENTIAL_KEY: NEW,
    TICKET_CREDENTIAL_KID: 'local-v2',
  });
  assert.throws(
    () =>
      openCredentialToken(credential.encryptedToken, removed, credential.kid),
    /unsupported credential key id/,
  );
  assert.throws(() =>
    openCredentialToken(credential.encryptedToken, rotated, 'local-v2'),
  );
  assert.throws(() =>
    openCredentialToken(
      credential.encryptedToken.slice(1),
      rotated,
      credential.kid,
    ),
  );
  assert.throws(() => openCurrentCredentialForQr({
    encryptedToken: credential.encryptedToken,
    expectedTokenHash: '0'.repeat(64),
    kid: credential.kid,
    credentialKeyMaterial: rotated,
  }), /credential token hash mismatch/);
  assert.throws(() => openCurrentCredentialForQr({
    encryptedToken: credential.encryptedToken.slice(1),
    expectedTokenHash: credential.tokenHash,
    kid: credential.kid,
    credentialKeyMaterial: rotated,
  }));
});

test('DB-19 QR keyring: invalid configuration is rejected without exposing material', () => {
  for (const env of [
    { TICKET_CREDENTIAL_KEY: 'short' },
    { TICKET_CREDENTIAL_KEY: NEW, TICKET_CREDENTIAL_KID: '../bad' },
    {
      TICKET_CREDENTIAL_KEY: NEW,
      TICKET_CREDENTIAL_KID: 'local-v2',
      TICKET_CREDENTIAL_LEGACY_KEYS: '{',
    },
    {
      TICKET_CREDENTIAL_KEY: NEW,
      TICKET_CREDENTIAL_KID: 'local-v2',
      TICKET_CREDENTIAL_LEGACY_KEYS: JSON.stringify({ 'local-v2': OLD }),
    },
    {
      TICKET_CREDENTIAL_KEY: NEW,
      TICKET_CREDENTIAL_KID: 'local-v2',
      TICKET_CREDENTIAL_LEGACY_KEYS: `{"local-v1":"${OLD}","local-v1":"${NEW}"}`,
    },
    {
      TICKET_CREDENTIAL_KEY: NEW,
      TICKET_CREDENTIAL_KID: 'local-v2',
      TICKET_CREDENTIAL_LEGACY_KEYS: `{"local-v1":"${OLD}","local\\u002dv1":"${NEW}"}`,
    },
  ]) {
    assert.throws(
      () => readCredentialKeyringEnvironment(env),
      (error) => {
        assert.equal(error.message, 'ticket credential keyring is invalid');
        assert.ok(!error.message.includes(NEW));
        assert.ok(!error.message.includes(OLD));
        return true;
      },
    );
  }
});

test('DB-19 QR keyring: duplicate kid with non-string first value is rejected', () => {
  for (const raw of [
    `{"local-v1":1,"local-v1":"${OLD}"}`,
    `{"local-v1":{"nested":"value"},"local\\u002dv1":"${OLD}"}`,
  ]) {
    assert.throws(
      () => readCredentialKeyringEnvironment({
        TICKET_CREDENTIAL_KEY: NEW,
        TICKET_CREDENTIAL_KID: 'local-v2',
        TICKET_CREDENTIAL_LEGACY_KEYS: raw,
      }),
      (error) => {
        assert.equal(error.message, 'ticket credential keyring is invalid');
        assert.ok(!error.message.includes(OLD));
        assert.ok(!error.message.includes(NEW));
        return true;
      },
    );
  }
});
