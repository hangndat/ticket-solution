// GATE-03 R-layer: real API process + signing-key rotation between restarts.
//
// Proves, on an isolated stack (Docker PostgreSQL/Keycloak/Mailpit/MinIO) with a
// real apps/api process and real OIDC tokens (no mocked crypto/auth):
//   R-1  attendee /me/tickets returns an ES256 JWS envelope with no PII claims,
//        whose signature verifies against the configured public verification key;
//   R-2  staff reserve + confirm through that exact JWS mutates the same
//        isolated PostgreSQL to USED;
//   R-3  rotating the current signing kid between API restarts (retaining the
//        old public verification key) keeps old-kid JWs valid, signs new JWs
//        with the new kid, and denies unknown kids with a reject-audit row and
//        no business mutation.
//
// Reuses tests/e2e/harness/runtime.mjs and tests/e2e/harness/seed.mjs without
// editing them. Run directly (dist already built) or via
// `node tests/e2e/backend/entry.mjs --case GATE-03 --suite R --no-build`.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import test from 'node:test';
import {
  createRuntime,
  destroyRuntime,
  processEnvironment,
  startProcess,
  waitFor,
  getLocalJson,
  ROOT,
} from '../harness/runtime.mjs';
import { seedRuntime } from '../harness/seed.mjs';

const requireBackend = createRequire(
  new URL('../../../packages/backend/package.json', import.meta.url),
);
const { Client } = requireBackend('pg');
const backend = requireBackend('./dist/index.js');

const CASE_ID = 'GATE-03';
const API_ENTRY = new URL('../../../apps/api/dist/main.js', import.meta.url)
  .pathname;

function newSigningKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

function sealSigningKey(privateKeyPem, credentialKeyMaterial) {
  return backend.sealCredentialToken(
    privateKeyPem,
    backend.deriveGateSigningSealKey(credentialKeyMaterial),
  ).encryptedToken;
}

// TLS-terminating HTTPS proxy forwards to the isolated loopback API/Keycloak;
// trust the run-scoped CA the same way runtime.getLocalJson does.
function httpsJson(state, method, origin, path, { token, json, form, headers } = {}) {
  const url = new URL(path, origin);
  const payload = form
    ? form.toString()
    : json
      ? JSON.stringify(json)
      : null;
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: '127.0.0.1',
        servername: url.hostname,
        port: state.tlsPort,
        path: url.pathname + url.search,
        method,
        headers: {
          host: url.host,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? {
                'content-type': form
                  ? 'application/x-www-form-urlencoded'
                  : 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
          ...(headers ?? {}),
        },
        ca: readFileSync(state.cert),
        timeout: 15_000,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { raw };
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    if (payload) req.write(payload);
    req.end();
  });
}

async function oidcToken(state, actor) {
  const account = state.caseAccounts[CASE_ID][actor];
  const form = new URLSearchParams({
    grant_type: 'password',
    client_id: 'e2e-http',
    client_secret: state.clientSecrets['e2e-http'],
    username: account.username,
    password: account.password,
    scope: 'openid profile email',
  });
  const result = await httpsJson(
    state,
    'POST',
    state.origins.auth,
    `/realms/${state.realm}/protocol/openid-connect/token`,
    { form },
  );
  assert.equal(result.status, 200, `OIDC password grant for ${actor}`);
  return result.body.access_token;
}

async function api(state, token, method, path, body, headers) {
  return httpsJson(state, method, state.origins.api, `/v1${path}`, {
    token,
    json: body,
    headers,
  });
}

async function pgRows(state, statement, values) {
  // Ground-truth snapshot as the isolated postgres superuser (bypasses RLS).
  const client = new Client({
    host: '127.0.0.1',
    port: state.ports.pg,
    database: 'e2e',
    user: 'postgres',
    password: state.secrets.pg,
  });
  await client.connect();
  try {
    const result = await client.query(statement, values);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function gateSnapshot(state, f, eventId, ticketId, rejectReason) {
  const [row] = await pgRows(
    state,
    `SELECT
       (SELECT state FROM tickets WHERE tenant_id = $1::uuid AND id = $2::uuid) AS ticket_state,
       (SELECT credential_version FROM tickets WHERE tenant_id = $1::uuid AND id = $2::uuid) AS credential_version,
       (SELECT count(*)::int FROM checkin_reservations WHERE tenant_id = $1::uuid AND ticket_id = $2::uuid) AS reservation_count,
       (SELECT count(*)::int FROM checkins WHERE tenant_id = $1::uuid AND ticket_id = $2::uuid) AS checkin_count,
       (SELECT count(*)::int FROM audit_logs WHERE tenant_id = $1::uuid AND event_id = $3::uuid
          AND action = 'gate.reject' AND reason = $4) AS reject_count`,
    [f.tenantId, ticketId, eventId, rejectReason],
  );
  return row;
}

async function issueTicket(state, token, f, code) {
  const result = await api(
    state,
    token,
    'POST',
    `/tenants/${f.tenantId}/events/${f.eventId}/redemptions`,
    {
      code,
      formVersion: 'form-v1',
      termsVersion: 'terms-v1',
      answers: f.data?.answers ?? {},
      termsAccepted: true,
    },
    { 'idempotency-key': randomUUID() },
  );
  assert.equal(result.status, 201, `issue ticket from ${code}`);
  return result.body.ticketId;
}

function decodeJws(jws) {
  const [header, claims] = jws.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    claims: JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')),
  };
}

test('GATE-03 R: real /me/tickets JWS + reserve/confirm + kid rotation between API restarts', { timeout: 600_000 }, async () => {
  let state;
  let apiChild;
  try {
    state = await createRuntime([CASE_ID]);

    // Phase-0 signing key (kid=e2e), sealed private key, public verification ring.
    const phase1 = newSigningKeypair();
    state.secrets.gateCredentialCurrentKeyId = 'e2e';
    state.secrets.gateCredentialSigningKeySealed = sealSigningKey(
      phase1.privateKeyPem,
      state.secrets.credential,
    );
    state.secrets.gateCredentialVerifyKeysJson = JSON.stringify([
      { kid: 'e2e', alg: 'ES256', publicKeyPem: phase1.publicKeyPem },
    ]);
    state.secrets.gateManualCodePepper = randomBytes(32).toString('hex');

    // Match run.mjs seed env so in-process seedRuntime sees the tombstone
    // keyring (avoids a noisy non-fatal alert; not GATE-03 specific).
    process.env.ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID = 'e2e';
    process.env.ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON = JSON.stringify([
      {
        keyId: 'e2e',
        secretBase64: Buffer.from(state.secrets.hmac, 'hex').toString('base64'),
      },
    ]);

    await seedRuntime(state, [CASE_ID]);
    const manifest = JSON.parse(readFileSync(state.manifestPath, 'utf8'));
    const f = manifest.cases[CASE_ID];
    const { ticketId, tenantId, eventId } = f;

    const startApi = () => {
      apiChild = startProcess(
        state,
        'api',
        process.execPath,
        [API_ENTRY],
        { ...processEnvironment(state), PORT: String(state.ports.api) },
      );
      return waitFor('API health', () =>
        getLocalJson(state, state.origins.api, '/v1/health'),
      );
    };
    await startApi();

    const attendee = await oidcToken(state, 'attendee');
    const scanner = await oidcToken(state, 'scanner');

    // R-1: real attendee /me/tickets returns ES256 JWS envelope, no PII.
    const detail = await api(
      state,
      attendee,
      'GET',
      `/me/tickets/${ticketId}?tenantId=${tenantId}`,
    );
    assert.equal(detail.status, 200);
    const envelope = detail.body.gateCredential;
    assert.equal(envelope?.v, 1);
    assert.equal(envelope?.kind, 'ticket.gate_credential');
    assert.equal(typeof envelope?.jws, 'string');
    const jws = envelope.jws;
    const decoded = decodeJws(jws);
    assert.equal(decoded.header.alg, 'ES256');
    assert.equal(decoded.header.kid, 'e2e');
    assert.deepEqual(Object.keys(decoded.claims).sort(), [
      'aud',
      'eid',
      'iat',
      'iss',
      'jti',
      'tid',
      'tkt',
      'ver',
    ]);
    assert.equal(decoded.claims.aud, 'gate');
    assert.equal(decoded.claims.tid, tenantId);
    assert.equal(decoded.claims.eid, eventId);
    assert.equal(decoded.claims.tkt, ticketId);
    assert.ok(!Object.hasOwn(decoded.claims, 'exp'), 'no exp on QR credential');
    const claimsJson = JSON.stringify(decoded.claims);
    assert.doesNotMatch(claimsJson, /email|name|phone|address|sub/i, 'no PII');

    // Cryptographically verify the JWS against the public verification key.
    const jose = requireBackend('jose');
    const verified = await jose.jwtVerify(
      jws,
      createPublicKey(phase1.publicKeyPem),
      { issuer: 'vemoki-gate', audience: 'gate', algorithms: ['ES256'] },
    );
    assert.equal(verified.payload.tkt, ticketId);

    // R-2: real staff reserve + confirm through that exact JWS.
    const session = await api(state, scanner, 'POST', gateSessions(eventId), {
      tenantId,
    });
    assert.equal(session.status, 200);
    const sessionId = session.body.sessionId;
    const reservation = await api(
      state,
      scanner,
      'POST',
      gateReservations(eventId),
      { tenantId, staffSessionId: sessionId, presented: { kind: 'qr', jws } },
    );
    assert.equal(reservation.status, 200);
    const confirm = await api(
      state,
      scanner,
      'POST',
      `${gateReservations(eventId)}/${reservation.body.reservationId}/confirm`,
      { tenantId, staffSessionId: sessionId, token: reservation.body.token },
    );
    assert.equal(confirm.status, 200);
    let snap = await gateSnapshot(state, f, eventId, ticketId, '');
    assert.equal(snap.ticket_state, 'USED');
    assert.equal(Number(snap.checkin_count), 1);

    // Second fresh ACTIVE ticket for the rotation phase.
    const ticket2 = await issueTicket(state, attendee, f, f.secondCode);

    // R-3: rotate the signing kid between API restarts, retaining the old key.
    const phase2 = newSigningKeypair();
    const oldKidJws = await backend.signGateCredentialJws({
      claims: { tid: tenantId, eid: eventId, tkt: ticket2, ver: 1 },
      privateKeyPem: phase1.privateKeyPem,
      kid: 'e2e',
    });
    const unknownKidJws = await backend.signGateCredentialJws({
      claims: { tid: tenantId, eid: eventId, tkt: ticket2, ver: 1 },
      privateKeyPem: phase1.privateKeyPem,
      kid: 'unknown-e2e-key',
    });

    // Stop API, re-key the signing config, restart on the same loopback port.
    const oldChild = apiChild;
    if (oldChild.exitCode === null && oldChild.signalCode === null && oldChild.pid) {
      const exited = once(oldChild, 'exit');
      try {
        process.kill(-oldChild.pid, 'SIGTERM');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
      const timer = setTimeout(() => {
        try {
          process.kill(-oldChild.pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, 5000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
    state.secrets.gateCredentialCurrentKeyId = 'e2e-2';
    state.secrets.gateCredentialSigningKeySealed = sealSigningKey(
      phase2.privateKeyPem,
      state.secrets.credential,
    );
    state.secrets.gateCredentialVerifyKeysJson = JSON.stringify([
      { kid: 'e2e', alg: 'ES256', publicKeyPem: phase1.publicKeyPem },
      { kid: 'e2e-2', alg: 'ES256', publicKeyPem: phase2.publicKeyPem },
    ]);
    await startApi();

    // (a) old-kid JWS (issued before rotation) still reserves.
    const session2 = await api(state, scanner, 'POST', gateSessions(eventId), {
      tenantId,
    });
    assert.equal(session2.status, 200);
    const sessionId2 = session2.body.sessionId;
    const oldKidReserve = await api(
      state,
      scanner,
      'POST',
      gateReservations(eventId),
      {
        tenantId,
        staffSessionId: sessionId2,
        presented: { kind: 'qr', jws: oldKidJws },
      },
    );
    assert.equal(oldKidReserve.status, 200, 'old-kid JWS must still reserve');

    // (b) fresh /me/tickets now signs with the new kid.
    const detail2 = await api(
      state,
      attendee,
      'GET',
      `/me/tickets/${ticket2}?tenantId=${tenantId}`,
    );
    assert.equal(detail2.status, 200);
    const jws2 = detail2.body.gateCredential.jws;
    assert.equal(decodeJws(jws2).header.kid, 'e2e-2');

    // (c) unknown kid denied with reject-audit +1 and no mutation.
    const before = await gateSnapshot(
      state,
      f,
      eventId,
      ticket2,
      'CREDENTIAL_SIGNATURE_INVALID',
    );
    const denied = await api(state, scanner, 'POST', gateReservations(eventId), {
      tenantId,
      staffSessionId: sessionId2,
      presented: { kind: 'qr', jws: unknownKidJws },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'CREDENTIAL_SIGNATURE_INVALID');
    const after = await gateSnapshot(
      state,
      f,
      eventId,
      ticket2,
      'CREDENTIAL_SIGNATURE_INVALID',
    );
    assert.equal(after.ticket_state, before.ticket_state);
    assert.equal(after.reservation_count, before.reservation_count);
    assert.equal(after.checkin_count, before.checkin_count);
    assert.equal(
      Number(after.reject_count),
      Number(before.reject_count) + 1,
      'unknown kid must commit one gate.reject audit row',
    );

    const configHash = createHash('sha256')
      .update(state.secrets.gateCredentialVerifyKeysJson)
      .update('\n')
      .update(state.secrets.gateCredentialSigningKeySealed)
      .digest('hex')
      .slice(0, 16);
    console.log(
      `GATE-03 R PASS run ${state.id}: R-1 JWS kid=e2e verified; R-2 reserve/confirm USED; R-3 rotation kid=e2e->e2e-2 old-kid reserve OK, new-kid ${decodeJws(jws2).header.kid}, unknown-kid denied +reject-audit; configHash ${configHash}`,
    );
  } finally {
    if (state) await destroyRuntime(state);
  }
});

function gateSessions(eventId) {
  return `/gate/events/${eventId}/sessions`;
}

function gateReservations(eventId) {
  return `/gate/events/${eventId}/reservations`;
}
