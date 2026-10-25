#!/usr/bin/env node
/**
 * D5 Issue #25 load harness — throwaway Postgres + Nest API + Keycloak auth + k6.
 * Invoked by scripts/d5-load-baseline.sh (do not edit apps/*).
 *
 * S3 (TD §14.1): sustained ISSUE_RATE issue/s + CONFIRM_RATE confirm/s concurrent
 * for SUSTAIN_SEC (≥60s default). Dataset: EVENTS × TICKETS_PER_EVENT volume
 * (SQL-seeded, honestly labeled) + authenticated HTTP issue path for rate proof.
 * Scanners: SCANNERS per event × EVENTS.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  openCredentialToken,
  sealCredentialToken,
} from './lib/credential-crypto.mjs';

import { createScannerContexts, scannerContextSummary, interleaveEventJobs } from './load/scanner-context.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIGRATION_DIR = path.join(ROOT, 'packages/backend/prisma/migrations');

const TICKETS_PER_EVENT = Number(process.env.D5_LOAD_TICKETS_PER_EVENT || 20000);
const SCANNERS = Number(process.env.D5_LOAD_SCANNERS || 50);
const EVENTS = Number(process.env.D5_LOAD_EVENTS || 2);
const API_PORT = Number(process.env.D5_LOAD_API_PORT || 13101);
const PG_PORT = Number(process.env.D5_LOAD_PG_PORT || 55452);
const ISSUE_RATE = Number(process.env.D5_LOAD_ISSUE_RATE || 50);
const CONFIRM_RATE = Number(process.env.D5_LOAD_CONFIRM_RATE || 20);
const SUSTAIN_SEC = Number(process.env.D5_LOAD_SUSTAIN_SEC || 60);
/** Backend attendee max_tickets default is 5 — reuse subjects up to that. */
const TICKETS_PER_USER = Number(process.env.D5_LOAD_TICKETS_PER_USER || 5);
const ISSUE_HTTP_COUNT = Number(
  process.env.D5_LOAD_ISSUE_HTTP_COUNT || ISSUE_RATE * SUSTAIN_SEC,
);
const OIDC_ISSUER = (
  process.env.D5_LOAD_OIDC_ISSUER || 'http://127.0.0.1:8080/realms/ticket'
).replace(/\/$/, '');
const ARTIFACT_DIR =
  process.env.D5_LOAD_ARTIFACT_DIR || path.join(tmpdir(), 'd5-issue25');
const IMAGE = process.env.D5_DRILL_POSTGRES_IMAGE || 'postgres:18.1-alpine';
const CODE_PEPPER = 'local-dev-code-pepper-change-me';
const CODE_VERSION = 1;
const CRED_KEY = 'local-dev-credential-key';
const CLIENT_ID = process.env.OIDC_CLIENT_ID || 'ticket-web';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || 'dev-web-secret-change-me';
const STAFF_USER = process.env.D5_LOAD_STAFF_USER || 'staff@example.com';
const STAFF_PASS = process.env.D5_LOAD_STAFF_PASS || 'staff-demo';

const TENANT_ID = 'a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5';
const SUFFIX = randomBytes(4).toString('hex');
const PG_NAME = `d5-load-pg-${SUFFIX}`;
const PG_DB = 'd5_load';
const PG_PW = randomBytes(16).toString('hex');
const RUNTIME_USER = 'd5_load_runtime';
const RUNTIME_PW = randomBytes(16).toString('hex');

mkdirSync(ARTIFACT_DIR, { recursive: true });

const state = {
  apiChild: null,
  pgStarted: false,
};

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8' });
}

function psql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${PG_PW}`,
      PG_NAME,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-d',
      PG_DB,
      '-v',
      'ON_ERROR_STOP=1',
      '-qAt',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

function hashCode(raw) {
  const normalized = raw.trim().toUpperCase();
  return createHmac('sha256', CODE_PEPPER)
    .update(`v${CODE_VERSION}:${normalized}`)
    .digest('hex');
}

function cleanup() {
  if (state.apiChild && !state.apiChild.killed) {
    try {
      state.apiChild.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  if (state.pgStarted) {
    try {
      docker('rm', '-f', PG_NAME);
    } catch {
      /* ignore */
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function waitPg() {
  for (let i = 0; i < 60; i++) {
    try {
      docker(
        'exec',
        PG_NAME,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        PG_DB,
      );
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('postgres not ready');
}

function migrate() {
  const files = execFileSync(
    'bash',
    [
      '-lc',
      `find ${JSON.stringify(MIGRATION_DIR)} -mindepth 2 -maxdepth 2 -name migration.sql | sort`,
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  if (!files.length) throw new Error('no migrations');
  const ephemeralRoles = readFileSync(
    path.join(ROOT, 'infra/platform/sql/ephemeral-pre-migrate-roles.sql'),
    'utf8',
  );
  let sql =
    ephemeralRoles +
    `
GRANT CREATE, USAGE ON SCHEMA public TO migration_owner;
SET ROLE migration_owner;
`;
  for (const file of files) sql += readFileSync(file, 'utf8') + '\n';
  sql += 'RESET ROLE;\n';
  sql += `
CREATE ROLE ${RUNTIME_USER} LOGIN PASSWORD '${RUNTIME_PW}' NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT ticket_runtime TO ${RUNTIME_USER};
`;
  psql(sql);
}

async function httpJson(method, url, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json, text };
}

async function passwordToken(username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    username,
    password,
  });
  const { status, json } = await httpJson(
    'POST',
    `${OIDC_ISSUER}/protocol/openid-connect/token`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (status !== 200 || !json?.access_token) {
    throw new Error(
      `token failed for ${username}: ${status} ${JSON.stringify(json)}`,
    );
  }
  return json.access_token;
}

async function staffToken() {
  return passwordToken(STAFF_USER, STAFF_PASS);
}

async function attendeeToken() {
  return passwordToken('attendee@example.com', 'attendee-demo');
}

async function keycloakAdminToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN || 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
  });
  const base = OIDC_ISSUER.includes('192.168.')
    ? OIDC_ISSUER.replace(/\/realms\/ticket.*/, '')
    : 'http://127.0.0.1:8080';
  const { status, json } = await httpJson(
    'POST',
    `${base}/realms/master/protocol/openid-connect/token`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (status !== 200 || !json?.access_token) {
    throw new Error(`keycloak admin token failed: ${status} ${JSON.stringify(json)}`);
  }
  return { token: json.access_token, base };
}

/** Parallel Keycloak users — ceil(issueCount / ticketsPerUser). */
async function provisionIssueAttendees(userCount) {
  const { token, base } = await keycloakAdminToken();
  const users = [];
  const pass = 'Load-Demo-Pass-1';
  const concurrency = 25;
  let next = 0;
  async function worker() {
    while (next < userCount) {
      const i = next++;
      const email = `d5-load-attendee-${SUFFIX}-${i}@example.com`;
      const createRes = await fetch(`${base}/admin/realms/ticket/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email,
          email,
          enabled: true,
          emailVerified: true,
          firstName: 'D5',
          lastName: `Load${i}`,
          credentials: [{ type: 'password', value: pass, temporary: false }],
        }),
      });
      if (createRes.status !== 201 && createRes.status !== 409) {
        const t = await createRes.text();
        throw new Error(`create user ${email}: ${createRes.status} ${t.slice(0, 200)}`);
      }
      users.push({ email, pass, index: i });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  users.sort((a, b) => a.index - b.index);
  return users;
}

async function cleanupIssueAttendees(users) {
  try {
    const { token, base } = await keycloakAdminToken();
    const concurrency = 25;
    let next = 0;
    async function worker() {
      while (next < users.length) {
        const u = users[next++];
        const q = new URLSearchParams({ username: u.email, exact: 'true' });
        const list = await fetch(`${base}/admin/realms/ticket/users?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!list.ok) continue;
        const arr = await list.json();
        for (const row of arr) {
          await fetch(`${base}/admin/realms/ticket/users/${row.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } catch {
    /* best-effort cleanup */
  }
}

async function startApi(databaseUrl) {
  const logPath = path.join(ARTIFACT_DIR, `api-${SUFFIX}.log`);
  const log = createWriteStream(logPath);
  const env = {
    ...process.env,
    PORT: String(API_PORT),
    HOST: '127.0.0.1',
    DATABASE_URL: databaseUrl,
    OIDC_ISSUER,
    OIDC_AUDIENCE: 'ticket-api',
    OIDC_JWKS_URL: `${OIDC_ISSUER}/protocol/openid-connect/certs`,
    CODE_HMAC_PEPPER: CODE_PEPPER,
    CODE_HMAC_VERSION: String(CODE_VERSION),
    TICKET_CREDENTIAL_KEY: CRED_KEY,
    NODE_ENV: 'development',
  };
  state.apiChild = spawn('node', [path.join(ROOT, 'apps/api/dist/main.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  state.apiChild.stdout.pipe(log);
  state.apiChild.stderr.pipe(log);
  const base = `http://127.0.0.1:${API_PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/v1/health`);
      if (r.ok) return { base, logPath };
    } catch {
      /* retry */
    }
    if (state.apiChild.exitCode != null) {
      throw new Error(`API exited early; see ${logPath}`);
    }
    await sleep(500);
  }
  throw new Error(`API health timeout; see ${logPath}`);
}

function seedVolume(eventIds, staffUserId, attendeeUserId) {
  const typeId = randomUUID();
  const sourceId = randomUUID();
  const seedStart = Date.now();

  psql(`
INSERT INTO tenants (id, slug, name)
VALUES ('${TENANT_ID}', 'd5-load-tenant', 'D5 load tenant')
ON CONFLICT DO NOTHING;
`);

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];
    psql(`
INSERT INTO events (tenant_id, id, slug, name, status, timezone, redemption_opens_at, redemption_closes_at)
VALUES (
  '${TENANT_ID}', '${eventId}', 'load-event-${i + 1}', 'Load Event ${i + 1}',
  'PUBLISHED', 'Asia/Ho_Chi_Minh', now() - interval '1 hour', now() + interval '7 days'
);
`);
  }

  const memberId = randomUUID();
  psql(`
INSERT INTO memberships (id, tenant_id, user_id, role, permissions, activated_at)
VALUES (
  '${memberId}', '${TENANT_ID}', '${staffUserId}', 'STAFF',
  ARRAY['gate.confirm','gate.undo','ticket.revoke','inventory.import','config.publish','report.read','redemption.approve']::text[],
  now()
);
`);

  for (const eventId of eventIds) {
    psql(`
INSERT INTO event_assignments (id, tenant_id, event_id, membership_id, permissions, activated_at)
VALUES (
  '${randomUUID()}', '${TENANT_ID}', '${eventId}', '${memberId}',
  ARRAY['gate.confirm','gate.undo','ticket.revoke','inventory.import','config.publish','report.read','redemption.approve']::text[],
  now()
);
`);
  }

  const eventMeta = [];
  for (let ei = 0; ei < eventIds.length; ei++) {
    const eventId = eventIds[ei];
    const tId = randomUUID();
    const sId = randomUUID();
    const qbEvent = randomUUID();
    const qbType = randomUUID();
    const qbSrc = randomUUID();
    psql(`
INSERT INTO ticket_types (tenant_id, event_id, id, label)
VALUES ('${TENANT_ID}', '${eventId}', '${tId}', 'General');
INSERT INTO issuance_sources (tenant_id, event_id, id, name, approval_mode)
VALUES ('${TENANT_ID}', '${eventId}', '${sId}', 'VIP', 'AUTO');
INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
VALUES ('${TENANT_ID}', '${eventId}', '${sId}', '${tId}');
INSERT INTO quota_buckets (tenant_id, event_id, id, scope, scope_id, capacity, allocated)
VALUES
  ('${TENANT_ID}', '${eventId}', '${qbEvent}', 'EVENT', NULL, ${TICKETS_PER_EVENT}, 0),
  ('${TENANT_ID}', '${eventId}', '${qbType}', 'TICKET_TYPE', '${tId}', ${TICKETS_PER_EVENT}, 0),
  ('${TENANT_ID}', '${eventId}', '${qbSrc}', 'ISSUANCE_SOURCE', '${sId}', ${TICKETS_PER_EVENT}, 0);
`);
    eventMeta.push({ eventId, tId, sId, qbEvent, qbType, qbSrc });
  }

  // HTTP-issue pool on event 0 — leave ACTIVE volume for concurrent confirm + scanners.
  const confirmReservePerEvent =
    Math.ceil((CONFIRM_RATE * SUSTAIN_SEC) / EVENTS) + SCANNERS * 2;
  const httpCodes = [];
  const first = eventMeta[0];
  const httpCount = Math.min(
    ISSUE_HTTP_COUNT,
    Math.max(0, TICKETS_PER_EVENT - confirmReservePerEvent),
  );
  if (httpCount < ISSUE_RATE * SUSTAIN_SEC * 0.5) {
    console.warn(
      `warn: http issue pool only ${httpCount} (wanted ${ISSUE_RATE * SUSTAIN_SEC}); raise D5_LOAD_TICKETS_PER_EVENT or lower rates`,
    );
  }
  for (let i = 0; i < httpCount; i++) {
    const raw = `HTTP-ISSUE-${i.toString().padStart(5, '0')}`;
    const codeId = randomUUID();
    const hmac = hashCode(raw);
    psql(`
INSERT INTO redemption_codes (
  tenant_id, event_id, id, code_hmac, code_pepper_version, source_id, ticket_type_id, status
) VALUES (
  '${TENANT_ID}', '${first.eventId}', '${codeId}', '${hmac}', ${CODE_VERSION},
  '${first.sId}', '${first.tId}', 'AVAILABLE'
);
`);
    httpCodes.push(raw);
  }

  // Volume tickets: SQL seed for S1 volume proof — NOT counted as HTTP issue RPS.
  // Sample credentials use real AES-GCM so invariants can decrypt/verify.
  for (let mi = 0; mi < eventMeta.length; mi++) {
    const meta = eventMeta[mi];
    const volumeCount =
      mi === 0 ? TICKETS_PER_EVENT - httpCount : TICKETS_PER_EVENT;
    if (volumeCount <= 0) continue;

    // Real sealed sample for decrypt invariant (first ticket of each event).
    const sampleToken = `vol-sample-${meta.eventId}`;
    const sealed = sealCredentialToken(sampleToken, CRED_KEY);

    const batchSql = `
WITH seq AS (
  SELECT generate_series(1, ${volumeCount}) AS n
),
ins_codes AS (
  INSERT INTO redemption_codes (
    tenant_id, event_id, id, code_hmac, code_pepper_version, source_id, ticket_type_id, status
  )
  SELECT
    '${TENANT_ID}'::uuid,
    '${meta.eventId}'::uuid,
    gen_random_uuid(),
    encode(sha256(('vol:' || n::text || ':${meta.eventId}')::bytea), 'hex'),
    ${CODE_VERSION},
    '${meta.sId}'::uuid,
    '${meta.tId}'::uuid,
    'CONSUMED'
  FROM seq
  RETURNING id
),
numbered AS (
  SELECT id, row_number() OVER () AS n FROM ins_codes
),
ins_req AS (
  INSERT INTO redemption_requests (
    tenant_id, event_id, id, actor_user_id, redemption_code_id, status
  )
  SELECT
    '${TENANT_ID}'::uuid,
    '${meta.eventId}'::uuid,
    gen_random_uuid(),
    '${attendeeUserId}'::uuid,
    id,
    'ISSUED'
  FROM numbered
  RETURNING id, redemption_code_id
),
req_num AS (
  SELECT id AS request_id, redemption_code_id, row_number() OVER () AS n FROM ins_req
),
ins_tickets AS (
  INSERT INTO tickets (
    tenant_id, event_id, id, owner_user_id, ticket_type_id, source_id, request_id,
    redemption_code_id, state, credential_version
  )
  SELECT
    '${TENANT_ID}'::uuid,
    '${meta.eventId}'::uuid,
    gen_random_uuid(),
    '${attendeeUserId}'::uuid,
    '${meta.tId}'::uuid,
    '${meta.sId}'::uuid,
    request_id,
    redemption_code_id,
    'ACTIVE',
    1
  FROM req_num
  RETURNING id
),
numbered_t AS (
  SELECT id, row_number() OVER () AS n FROM ins_tickets
)
INSERT INTO ticket_credentials (
  tenant_id, ticket_id, version, kid, token_hash, encrypted_token, status
)
SELECT
  '${TENANT_ID}'::uuid,
  id,
  1,
  'local-v1',
  encode(sha256(('pending:' || id::text)::bytea), 'hex'),
  'enc:pending-seal',
  'ACTIVE'
FROM numbered_t;

UPDATE quota_buckets
SET allocated = ${volumeCount}, updated_at = now()
WHERE tenant_id = '${TENANT_ID}'::uuid AND event_id = '${meta.eventId}'::uuid;
`;
    psql(batchSql);
    // Seal EVERY volume credential with real AES-GCM (not placeholder enc:).
    sealAllCredentialsForEvent(meta.eventId);
    meta.sampleSealed = sealed;
    meta.samplePlain = sampleToken;
  }

  const seedMs = Date.now() - seedStart;
  return { eventMeta, httpCodes, seedMs, typeId, sourceId, httpCount };
}

/** Replace pending placeholders with AES-GCM ciphertext for all tickets on event. */
function sealAllCredentialsForEvent(eventId) {
  const ids = psql(`
SELECT ticket_id::text FROM ticket_credentials tc
JOIN tickets t ON t.id = tc.ticket_id AND t.tenant_id = tc.tenant_id
WHERE t.event_id = '${eventId}'::uuid AND tc.encrypted_token = 'enc:pending-seal';
`)
    .split('\n')
    .filter(Boolean);
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const values = chunk
      .map((id) => {
        const plain = `vol-ticket:${id}`;
        const s = sealCredentialToken(plain, CRED_KEY);
        return `('${id}'::uuid,'${s.tokenHash}','${s.encryptedToken}')`;
      })
      .join(',\n');
    psql(`
UPDATE ticket_credentials AS tc SET
  token_hash = v.token_hash,
  encrypted_token = v.encrypted_token,
  kid = 'local-v1'
FROM (VALUES ${values}) AS v(ticket_id, token_hash, encrypted_token)
WHERE tc.ticket_id = v.ticket_id AND tc.tenant_id = '${TENANT_ID}'::uuid;
`);
  }
  const left = psql(`
SELECT count(*)::text FROM ticket_credentials tc
JOIN tickets t ON t.id = tc.ticket_id
WHERE t.event_id = '${eventId}'::uuid
  AND (tc.encrypted_token LIKE 'enc:%' OR tc.encrypted_token = '');
`);
  if (Number(left) !== 0) {
    throw new Error(
      `sealAllCredentialsForEvent: ${left} non-AES credentials remain on ${eventId}`,
    );
  }
}

async function openSessions(base, staffTok, eventId, n) {
  const sessions = [];
  for (let i = 0; i < n; i++) {
    const { status, json } = await httpJson(
      'POST',
      `${base}/v1/gate/events/${eventId}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${staffTok}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      },
    );
    if (status !== 200 && status !== 201) {
      throw new Error(`open session failed: ${status} ${JSON.stringify(json)}`);
    }
    const sid = json.sessionId || json.staffSessionId || json.id;
    if (!sid) throw new Error(`no session id in ${JSON.stringify(json)}`);
    sessions.push(sid);
  }
  return sessions;
}

function listTicketIds(eventId, limit) {
  return psql(`
SELECT id::text FROM tickets
WHERE tenant_id = '${TENANT_ID}'::uuid AND event_id = '${eventId}'::uuid AND state = 'ACTIVE'
ORDER BY created_at
LIMIT ${limit};
`)
    .split('\n')
    .filter(Boolean);
}

function runK6(envMap, script, outJson, extraEnv = {}) {
  execFileSync('k6', ['run', '--out', `json=${outJson}`, script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envMap,
      ...extraEnv,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function invariants(eventMeta, expectedCheckinsByEvent) {
  const rows = {};
  let allOk = true;
  for (const meta of eventMeta) {
    const eventId = meta.eventId;
    const line = psql(`
SELECT
  (SELECT count(*) FROM tickets WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid) || '|' ||
  (SELECT allocated FROM quota_buckets WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND scope='EVENT') || '|' ||
  (SELECT allocated FROM quota_buckets WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND scope='TICKET_TYPE') || '|' ||
  (SELECT allocated FROM quota_buckets WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND scope='ISSUANCE_SOURCE') || '|' ||
  (SELECT count(*) FROM ticket_credentials tc
     JOIN tickets t ON t.tenant_id=tc.tenant_id AND t.id=tc.ticket_id
     WHERE t.event_id='${eventId}'::uuid AND tc.kid IS NOT NULL AND tc.kid <> '') || '|' ||
  (SELECT count(*) FROM checkins WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND undone_at IS NULL) || '|' ||
  (SELECT count(*) FROM tickets WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND state='USED') || '|' ||
  (SELECT count(*) FROM outbox WHERE tenant_id='${TENANT_ID}'::uuid) || '|' ||
  (SELECT count(*) FROM audit_logs WHERE tenant_id='${TENANT_ID}'::uuid) || '|' ||
  (SELECT count(*) FROM checkin_reservations WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND status='CONFIRMED') || '|' ||
  (SELECT count(DISTINCT ticket_id) FROM checkins WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND undone_at IS NULL) || '|' ||
  (SELECT count(*) FROM redemption_codes WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid) || '|' ||
  (SELECT count(DISTINCT code_hmac) FROM redemption_codes WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid) || '|' ||
  (SELECT count(*) FROM redemption_codes WHERE tenant_id='${TENANT_ID}'::uuid AND event_id='${eventId}'::uuid AND code_pepper_version=${CODE_VERSION}) || '|' ||
  (SELECT count(*) FROM ticket_credentials tc JOIN tickets t ON t.id=tc.ticket_id
     WHERE t.event_id='${eventId}'::uuid AND tc.encrypted_token NOT LIKE 'enc:%' AND length(tc.encrypted_token) > 40);
`);
    const [
      tickets,
      allocEvent,
      allocType,
      allocSrc,
      creds,
      checkins,
      used,
      outbox,
      audit,
      confirmedRes,
      distinctCheckinTickets,
      codeCount,
      distinctHmac,
      pepperOk,
      aesCreds,
    ] = line.split('|').map(Number);

    let sampleDecryptOk = false;
    let allSampleOk = false;
    try {
      // Prefer volume-sealed rows (plain = vol-ticket:<id>); HTTP-issued also must decrypt.
      const sample = psql(`
SELECT tc.ticket_id::text || '|' || tc.encrypted_token FROM ticket_credentials tc
JOIN tickets t ON t.id=tc.ticket_id
WHERE t.event_id='${eventId}'::uuid
  AND tc.encrypted_token NOT LIKE 'enc:%'
ORDER BY tc.ticket_id
LIMIT 8;
`).split('\n').filter(Boolean);
      let okN = 0;
      for (const row of sample) {
        const [tid, enc] = row.split('|');
        const plain = openCredentialToken(enc, CRED_KEY);
        if (plain === `vol-ticket:${tid}` || plain.length > 0) okN++;
      }
      sampleDecryptOk = okN >= 1;
      allSampleOk = okN === sample.length && sample.length > 0;
    } catch {
      sampleDecryptOk = false;
    }

    const expectedCheckins = expectedCheckinsByEvent[eventId] ?? null;
    const ticketsMatchAllocated = tickets === allocEvent;
    const quotaScopesAligned =
      allocEvent === allocType && allocType === allocSrc;
    const everyTicketHasKid = creds === tickets;
    const checkinsMatchUsed = checkins === used;
    const noDoubleConfirm =
      distinctCheckinTickets === checkins && confirmedRes >= checkins;
    const checkinsMeetExpected =
      expectedCheckins == null ? true : checkins >= expectedCheckins;
    const hmacUnique = codeCount === distinctHmac && codeCount === tickets;
    const pepperConsistent = pepperOk === codeCount;
    const allAes = aesCreds === tickets;

    const ok =
      ticketsMatchAllocated &&
      quotaScopesAligned &&
      everyTicketHasKid &&
      checkinsMatchUsed &&
      noDoubleConfirm &&
      checkinsMeetExpected &&
      sampleDecryptOk &&
      allSampleOk &&
      hmacUnique &&
      pepperConsistent &&
      allAes;

    if (!ok) allOk = false;
    rows[eventId] = {
      tickets,
      allocatedEvent: allocEvent,
      allocatedType: allocType,
      allocatedSource: allocSrc,
      credentialsWithKid: creds,
      currentCheckins: checkins,
      usedTickets: used,
      outboxRowsTenant: outbox,
      auditLogsTenant: audit,
      confirmedReservations: confirmedRes,
      distinctCheckinTickets,
      sampleDecryptOk,
      allSampleOk,
      hmacUnique,
      pepperConsistent,
      allAesCredentials: allAes,
      codeCount,
      distinctHmac,
      ticketsMatchAllocated,
      quotaScopesAligned,
      everyTicketHasKid,
      checkinsMatchUsed,
      noDoubleConfirm,
      checkinsMeetExpected,
      ok,
    };
  }
  return { rows, allOk };
}

function extractK6Counters(summaryPath) {
  try {
    const data = JSON.parse(readFileSync(summaryPath, 'utf8'));
    const m = data.metrics || {};
    const val = (name) => m[name]?.values?.count ?? m[name]?.values?.rate ?? null;
    const p95 = (name) => m[name]?.values?.['p(95)'] ?? null;
    return {
      issueOk: val('s3_issue_ok'),
      issueFail: val('s3_issue_fail'),
      confirmOk: val('s3_confirm_ok'),
      confirmFail: val('s3_confirm_fail'),
      issueP95Ms: p95('s3_issue_ms'),
      confirmP95Ms: p95('s3_confirm_ms'),
      issueErrorRate: m.s3_issue_errors?.values?.rate ?? null,
      confirmErrorRate: m.s3_confirm_errors?.values?.rate ?? null,
      raw: data,
    };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function main() {
  console.log(
    `d5-load: tickets/event=${TICKETS_PER_EVENT} events=${EVENTS} scanners/event=${SCANNERS} issue=${ISSUE_RATE}/s confirm=${CONFIRM_RATE}/s sustain=${SUSTAIN_SEC}s api=:${API_PORT} pg=:${PG_PORT}`,
  );
  console.log(
    `hardware: ncpu=${process.env.D5_LOAD_HW_NCPU} mem_gb=${process.env.D5_LOAD_HW_MEM_GB}`,
  );

  docker(
    'run',
    '-d',
    '--name',
    PG_NAME,
    '--label',
    'ticket.task=d5-load',
    '-e',
    `POSTGRES_PASSWORD=${PG_PW}`,
    '-e',
    `POSTGRES_DB=${PG_DB}`,
    '-p',
    `127.0.0.1:${PG_PORT}:5432`,
    IMAGE,
  );
  state.pgStarted = true;
  await waitPg();
  migrate();

  const databaseUrl = `postgresql://${RUNTIME_USER}:${RUNTIME_PW}@127.0.0.1:${PG_PORT}/${PG_DB}`;
  const { base, logPath } = await startApi(databaseUrl);

  const staffTok = await staffToken();
  const attendeeTok = await attendeeToken();
  const meStaff = await httpJson('GET', `${base}/v1/me`, {
    headers: { Authorization: `Bearer ${staffTok}` },
  });
  const meAtt = await httpJson('GET', `${base}/v1/me`, {
    headers: { Authorization: `Bearer ${attendeeTok}` },
  });
  if (meStaff.status !== 200 || !meStaff.json?.userId) {
    throw new Error(`staff /v1/me failed: ${JSON.stringify(meStaff)}`);
  }
  if (meAtt.status !== 200 || !meAtt.json?.userId) {
    throw new Error(`attendee /v1/me failed: ${JSON.stringify(meAtt)}`);
  }
  const staffUserId = meStaff.json.userId;
  const attendeeUserId = meAtt.json.userId;

  const eventIds = Array.from({ length: EVENTS }, () => randomUUID());
  const { eventMeta, httpCodes, seedMs, httpCount } = seedVolume(
    eventIds,
    staffUserId,
    attendeeUserId,
  );

  const userCount = Math.ceil(httpCodes.length / TICKETS_PER_USER);
  console.log(
    `provisioning ${userCount} Keycloak attendees for ${httpCodes.length} issue jobs (${TICKETS_PER_USER}/user)…`,
  );
  const issueUsers = await provisionIssueAttendees(userCount + SCANNERS * EVENTS);
  state.provisionedUsers = issueUsers;

  // Prefetch one token per user (parallel), then map codes → tokens.
  const issueJobs = [];
  const tokenByEmail = new Map();
  try {
    const tokConcurrency = 20;
    let tokNext = 0;
    async function tokWorker() {
      while (tokNext < issueUsers.length) {
        const u = issueUsers[tokNext++];
        const tok = await passwordToken(u.email, u.pass);
        tokenByEmail.set(u.email, tok);
      }
    }
    await Promise.all(Array.from({ length: tokConcurrency }, () => tokWorker()));
    for (let i = 0; i < httpCodes.length; i++) {
      const user = issueUsers[Math.floor(i / TICKETS_PER_USER)];
      issueJobs.push({
        eventId: eventMeta[0].eventId,
        code: httpCodes[i],
        token: tokenByEmail.get(user.email),
        idempotencyKey: randomUUID(),
      });
    }
  } catch (e) {
    await cleanupIssueAttendees(issueUsers);
    throw e;
  }

  // Sessions: SCANNERS per event × EVENTS
  const scannerContexts = await createScannerContexts({
    databaseUrl, base, tenantId: TENANT_ID, eventIds, scannersPerEvent: SCANNERS,
    users: issueUsers.slice(userCount), tokenByEmail, httpJson, openSessions,
  });
  const scannerIdentityContext = scannerContextSummary(scannerContexts, eventIds, SCANNERS);
  console.log('Scanner context:', JSON.stringify(scannerIdentityContext));
  const sessionsByEvent = {};
  let totalSessions = 0;
  for (const meta of eventMeta) {
    const sessions = scannerContexts[meta.eventId].map(scanner => scanner.sessionId);
    sessionsByEvent[meta.eventId] = sessions;
    totalSessions += sessions.length;
  }
  if (totalSessions !== SCANNERS * EVENTS) {
    throw new Error(
      `expected ${SCANNERS * EVENTS} sessions, got ${totalSessions}`,
    );
  }

  // Confirm jobs across both events — enough for CONFIRM_RATE × SUSTAIN_SEC
  const confirmNeed = CONFIRM_RATE * SUSTAIN_SEC;
  const confirmJobs = [];
  for (const meta of eventMeta) {
    const tickets = listTicketIds(
      meta.eventId,
      Math.ceil(confirmNeed / EVENTS) + SCANNERS,
    );
    if (tickets.length < SCANNERS) {
      throw new Error(
        `event ${meta.eventId}: need ≥${SCANNERS} ACTIVE tickets, got ${tickets.length}`,
      );
    }
    const sessions = sessionsByEvent[meta.eventId];
    for (let i = 0; i < tickets.length; i++) {
      confirmJobs.push({
        eventId: meta.eventId,
        ticketId: tickets[i],
        sessionId: sessions[i % sessions.length],
        staffToken: scannerContexts[meta.eventId][i % sessions.length].token,
      });
    }
  }

  const issueJobsFile = path.join(ARTIFACT_DIR, `issue-jobs-${SUFFIX}.json`);
  const confirmJobsFile = path.join(ARTIFACT_DIR, `confirm-jobs-${SUFFIX}.json`);
  writeFileSync(issueJobsFile, JSON.stringify(issueJobs), { mode: 0o600 });
  writeFileSync(confirmJobsFile, JSON.stringify(interleaveEventJobs(confirmJobs)), { mode: 0o600 });

  const healthScript = path.join(ROOT, 'scripts/load/health-burst.js');
  const healthOut = path.join(ARTIFACT_DIR, `k6-health-${SUFFIX}.json`);
  console.log('running k6 health burst…');
  let healthOk = true;
  try {
    runK6({ BASE_URL: base }, healthScript, healthOut);
  } catch (e) {
    healthOk = false;
    console.error('k6 health failed', e.message || e);
  }

  const s3Script = path.join(ROOT, 'scripts/load/s3-issue-confirm.js');
  const s3Out = path.join(ARTIFACT_DIR, `k6-s3-${SUFFIX}.json`);
  const s3Summary = path.join(ARTIFACT_DIR, `k6-s3-summary-${SUFFIX}.json`);
  console.log(
    `running k6 S3 concurrent issue=${ISSUE_RATE}/s confirm=${CONFIRM_RATE}/s for ${SUSTAIN_SEC}s…`,
  );
  let s3Ok = true;
  let s3Err = null;
  const s3Started = Date.now();
  try {
    runK6(
      {
        BASE_URL: base,
        TENANT_ID,
        ISSUE_JOBS_FILE: issueJobsFile,
        CONFIRM_JOBS_FILE: confirmJobsFile,
        ISSUE_RATE: String(ISSUE_RATE),
        CONFIRM_RATE: String(CONFIRM_RATE),
        SUSTAIN_SEC: `${SUSTAIN_SEC}s`,
        S3_SUMMARY_JSON: s3Summary,
        S3_MAX_ERROR_RATE: '0.05',
      },
      s3Script,
      s3Out,
    );
  } catch (e) {
    s3Ok = false;
    s3Err = String(e.message || e);
    console.error('k6 S3 failed', s3Err);
  }
  const s3ElapsedSec = (Date.now() - s3Started) / 1000;
  // Per-event gate scanner pass (50 VU × 2 iter) after S3 — extra coverage
  const gateResults = [];
  for (const meta of eventMeta) {
    const sessions = sessionsByEvent[meta.eventId];
    const tickets = listTicketIds(meta.eventId, SCANNERS * 4);
    const envFile = path.join(
      ARTIFACT_DIR,
      `k6-gate-env-${meta.eventId.slice(0, 8)}.env`,
    );
    // Prefer remaining ACTIVE tickets
    const active = listTicketIds(meta.eventId, SCANNERS * 2);
    const ticketPool = active.length >= SCANNERS ? active : tickets;
    writeFileSync(
      envFile,
      [
        `BASE_URL=${base}`,
        `STAFF_TOKEN=${staffTok}`,
        `TENANT_ID=${TENANT_ID}`,
        `EVENT_ID=${meta.eventId}`,
        `SESSION_IDS=${sessions.join(',')}`,
        `TICKET_IDS=${ticketPool.join(',')}`,
        `VUS=${SCANNERS}`,
        `ITERATIONS=2`,
        `MAX_ERROR_RATE=0.05`,
      ].join('\n'),
    );
    const k6Out = path.join(
      ARTIFACT_DIR,
      `k6-gate-${meta.eventId.slice(0, 8)}.json`,
    );
    const gateScript = path.join(ROOT, 'scripts/load/gate-scanners.js');
    let gateOk = true;
    let gateErr = null;
    try {
      const envMap = Object.fromEntries(
        readFileSync(envFile, 'utf8')
          .split('\n')
          .filter((l) => l && !l.startsWith('#'))
          .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1)];
          }),
      );
      const scannersFile = path.join(ARTIFACT_DIR, `scanners-${meta.eventId}.json`);
      writeFileSync(scannersFile, JSON.stringify(scannerContexts[meta.eventId]), { mode: 0o600 });
      runK6({ ...envMap, SCANNERS_FILE: scannersFile }, gateScript, k6Out);
    } catch (e) {
      gateOk = false;
      gateErr = String(e.message || e);
    }
    gateResults.push({
      eventId: meta.eventId,
      ok: gateOk,
      error: gateErr,
      artifact: k6Out,
      sessions: sessions.length,
    });
  }

  const s3Metrics = extractK6Counters(s3Summary);
  await cleanupIssueAttendees(issueUsers);
  const issueOkCount = s3Metrics.issueOk ?? 0;
  const confirmOkCount = s3Metrics.confirmOk ?? 0;
  const issueTarget = ISSUE_RATE * SUSTAIN_SEC;
  const confirmTarget = CONFIRM_RATE * SUSTAIN_SEC;
  // Allow 5% under-delivery on arrival-rate executors (k6 VU ramp).
  const issueRpsAchieved =
    s3ElapsedSec > 0 ? issueOkCount / Math.min(s3ElapsedSec, SUSTAIN_SEC) : 0;
  const confirmRpsAchieved =
    s3ElapsedSec > 0 ? confirmOkCount / Math.min(s3ElapsedSec, SUSTAIN_SEC) : 0;

  // Expected check-ins: gate sessions (SCANNERS*2) per event, minus small slack.
  // S3 confirms span events unevenly — assert tenant-wide below, not per-event share.
  const expectedCheckinsByEvent = {};
  for (const meta of eventMeta) {
    expectedCheckinsByEvent[meta.eventId] = Math.max(0, SCANNERS * 2 - 5);
  }

  const inv = invariants(eventMeta, expectedCheckinsByEvent);
  const report = await httpJson(
    'GET',
    `${base}/v1/tenants/${TENANT_ID}/events/${eventMeta[0].eventId}/report`,
    { headers: { Authorization: `Bearer ${staffTok}` } },
  );

  const admissionNote =
    'Run ./scripts/d5-admission-s4.sh for isolated ADR-15 edge; not inlined in API load path';

  const rateOk =
    issueRpsAchieved >= ISSUE_RATE * 0.9 &&
    confirmRpsAchieved >= CONFIRM_RATE * 0.9 &&
    s3ElapsedSec >= SUSTAIN_SEC * 0.95;
  const p95Ok =
    (s3Metrics.issueP95Ms == null || s3Metrics.issueP95Ms <= 1000) &&
    (s3Metrics.confirmP95Ms == null || s3Metrics.confirmP95Ms <= 1000);
  const errOk =
    (s3Metrics.issueErrorRate == null || s3Metrics.issueErrorRate < 0.05) &&
    (s3Metrics.confirmErrorRate == null || s3Metrics.confirmErrorRate < 0.05);
  const gateAllOk = gateResults.every((g) => g.ok);
  const scannersOk = totalSessions === SCANNERS * EVENTS;

  const totalDistinctCheckins = Object.values(inv.rows).reduce(
    (n, r) => n + Number(r.distinctCheckinTickets || 0),
    0,
  );
  const checkinsVsConfirmOk =
    confirmOkCount === 0 || totalDistinctCheckins >= Math.floor(confirmOkCount * 0.85);

    const outboxOk =
    Number(
      Object.values(inv.rows)[0]?.outboxRowsTenant ??
        Object.values(inv.rows)[0]?.outbox ??
        0,
    ) >= Math.floor(issueOkCount * 0.9) || issueOkCount === 0;

  const meetsPrdPilot =
    s3Ok &&
    healthOk &&
    rateOk &&
    p95Ok &&
    errOk &&
    gateAllOk &&
    scannersOk &&
    inv.allOk &&
    outboxOk &&
    checkinsVsConfirmOk &&
    issueOkCount >= issueTarget * 0.9 &&
    confirmOkCount >= confirmTarget * 0.9;

  // pass ≡ meetsPrdPilot (no weak “≥1 OK” escape hatch)
  const pass = meetsPrdPilot;

  const summary = {
    scenario: 'TD S3 sustained issue+confirm concurrent + S1 volume SQL seed',
    ticketsPerEventTarget: TICKETS_PER_EVENT,
    events: EVENTS,
    scannersPerEvent: SCANNERS,
    scannersTotal: totalSessions,
    scannerIdentityContext,
    sessionsByEvent: Object.fromEntries(
      Object.entries(sessionsByEvent).map(([k, v]) => [k, v.length]),
    ),
    volumeSeedMs: seedMs,
    volumeSeedNote:
      'ACTIVE tickets bulk-inserted in SQL for S1 volume; NOT counted as HTTP issue RPS. HTTP issue path measured separately via k6 S3.',
    httpIssuePoolSize: httpCount,
    s3: {
      issueRateTarget: ISSUE_RATE,
      confirmRateTarget: CONFIRM_RATE,
      sustainSecTarget: SUSTAIN_SEC,
      elapsedSec: s3ElapsedSec,
      ok: s3Ok,
      error: s3Err,
      metrics: {
        issueOk: issueOkCount,
        confirmOk: confirmOkCount,
        issueRpsAchieved,
        confirmRpsAchieved,
        issueP95Ms: s3Metrics.issueP95Ms,
        confirmP95Ms: s3Metrics.confirmP95Ms,
        issueErrorRate: s3Metrics.issueErrorRate,
        confirmErrorRate: s3Metrics.confirmErrorRate,
      },
      rateOk,
      p95Ok,
      errOk,
      artifact: s3Out,
      summaryArtifact: s3Summary,
    },
    admissionLayer: {
      implemented: true,
      measuredInThisHarness: false,
      adr: 'ADR-15',
      note: admissionNote,
      script: './scripts/d5-admission-s4.sh',
    },
    hardware: {
      ncpu: process.env.D5_LOAD_HW_NCPU,
      memGb: process.env.D5_LOAD_HW_MEM_GB,
    },
    healthK6: { ok: healthOk, artifact: healthOut },
    gateK6ByEvent: gateResults,
    invariants: inv.rows,
    invariantsOk: inv.allOk,
    reportApiStatus: report.status,
    reportSample: report.json,
    apiLog: logPath,
    db: { container: PG_NAME, port: PG_PORT },
    productionClaim: false,
    meetsPrdPilotWithoutCaveat: meetsPrdPilot,
    pass,
  };

  const outPath = path.join(ARTIFACT_DIR, `load-summary-${SUFFIX}.json`);
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  // Historical review snapshots are immutable unless a destination is explicit.
  if (process.env.D5_LOAD_REVIEW_SUMMARY_PATH) {
    writeFileSync(path.resolve(process.env.D5_LOAD_REVIEW_SUMMARY_PATH), JSON.stringify(summary, null, 2));
  }

  console.log(
    `D5_LOAD_BASELINE_${pass ? 'PASS' : 'FAIL'} scanners_total=${totalSessions} issue_ok=${issueOkCount} issue_rps=${issueRpsAchieved.toFixed(2)} confirm_ok=${confirmOkCount} confirm_rps=${confirmRpsAchieved.toFixed(2)} sustain_s=${s3ElapsedSec.toFixed(1)} health=${healthOk} gate=${gateAllOk} inv=${inv.allOk} meets_prd=${meetsPrdPilot}`,
  );
  console.log(`artifact=${outPath}`);
  console.log(
    'volume tickets SQL-seeded (not HTTP RPS); admission S4 via d5-admission-s4.sh; hardware-bound local Mac; not production SLO',
  );

  if (!pass) process.exitCode = 2;
  cleanup();
  state.pgStarted = false;
}

main().catch(async (err) => {
  if (state.provisionedUsers?.length) await cleanupIssueAttendees(state.provisionedUsers);
  console.error(err);
  cleanup();
  process.exit(1);
});
