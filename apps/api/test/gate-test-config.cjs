'use strict';

const { generateKeyPairSync } = require('node:crypto');
const { deriveGateSigningSealKey, sealCredentialToken } = require('@ticket/backend');

function createGateTestConfig(credentialKeyMaterial, kid = 'api-gate-test-kid') {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  const sealed = sealCredentialToken(
    privateKeyPem,
    deriveGateSigningSealKey(credentialKeyMaterial),
  );
  return {
    kid,
    privateKeyPem,
    publicKeyPem,
    env: {
      GATE_CREDENTIAL_CURRENT_KEY_ID: kid,
      GATE_CREDENTIAL_SIGNING_KEY_SEALED: sealed.encryptedToken,
      GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([
        { kid, alg: 'ES256', publicKeyPem },
      ]),
      GATE_MANUAL_CODE_PEPPER: 'api-gate-test-manual-pepper-value-at-least-32-bytes',
    },
  };
}

module.exports = { createGateTestConfig };
