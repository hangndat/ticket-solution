const { generateKeyPairSync } = require('node:crypto');

process.env.GATE_MANUAL_CODE_PEPPER ||= 'gate-test-only-pepper-32-byte-value';

const backend = require('../dist');

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const kid = 'gate-test-k1';
const rotatedPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicKey = pair.publicKey;
// Retain k1 beside the current k2 key, as production verification does during rotation.
const verifyKeys = [
  { kid: 'gate-test-k2', alg: 'ES256', key: rotatedPair.publicKey },
  { kid, alg: 'ES256', key: publicKey },
];

async function signedQr({ tenantId, eventId, ticketId, version = 1 }) {
  return backend.signGateCredentialJws({
    claims: { tid: tenantId, eid: eventId, tkt: ticketId, ver: version },
    privateKeyPem,
    kid,
  });
}

function emailSignerEnv(credentialKeyMaterial) {
  return {
    GATE_CREDENTIAL_CURRENT_KEY_ID: kid,
    GATE_CREDENTIAL_SIGNING_KEY_SEALED: backend.sealCredentialToken(
      privateKeyPem,
      backend.deriveGateSigningSealKey(credentialKeyMaterial),
    ).encryptedToken,
    GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([
      {
        kid,
        alg: 'ES256',
        publicKeyJwk: publicKey.export({ format: 'jwk' }),
      },
    ]),
  };
}

function withTestEmailSigner(options = {}) {
  const credentialKeyMaterial = String(
    options.credentialKeyMaterial ?? '',
  ).trim();
  if (credentialKeyMaterial.length < 16) return options;
  if (
    options.env &&
    [
      'GATE_CREDENTIAL_CURRENT_KEY_ID',
      'GATE_CREDENTIAL_SIGNING_KEY_SEALED',
      'GATE_CREDENTIAL_VERIFY_KEYS_JSON',
    ].some((key) => Object.prototype.hasOwnProperty.call(options.env, key))
  ) {
    return options;
  }
  return {
    ...options,
    env: {
      ...process.env,
      ...options.env,
      ...emailSignerEnv(credentialKeyMaterial),
    },
  };
}

async function reserveCheckin(tx, input) {
  if (input.presented) {
    return backend.reserveCheckin(tx, { ...input, verifyKeys: input.verifyKeys ?? verifyKeys });
  }
  // Existing invariant tests now obtain a real signed credential before invoking reserve.
  const rows = await tx.$queryRaw`
    SELECT credential_version
    FROM tickets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.ticketId}::uuid
  `;
  const jws = await signedQr({
    tenantId: input.tenantId,
    eventId: input.eventId,
    ticketId: input.ticketId,
    version: Number(rows[0]?.credential_version ?? 1),
  });
  return backend.reserveCheckin(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    staffSessionId: input.staffSessionId,
    actorUserId: input.actorUserId,
    presented: { kind: 'qr', jws },
    verifyKeys,
  });
}

module.exports = {
  reserveCheckin,
  signedQr,
  verifyKeys,
  privateKeyPem,
  kid,
  emailSignerEnv,
  withTestEmailSigner,
};
