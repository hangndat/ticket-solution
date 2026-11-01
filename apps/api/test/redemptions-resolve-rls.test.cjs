const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const jose = require('jose');
const { Client } = require('pg');
const {
  createOidcVerifier,
  createLocalJwks,
  createDatabase,
  createPrismaIdentityUserRepository,
  withTenant,
  seedEventInventory,
  tryConsumeRateLimit,
  readCodeHmacEnvironment,
  signGateCredentialJws,
  backfillCodeRoutingFromRedemptionCodes,
} = require('@ticket/backend');
const {
  migrationFiles,
} = require('../../../packages/backend/test/migration-files.cjs');
const { createApp } = require('../dist/app');
const { API_RATE_BUCKETS, API_RATE_LIMITS } = require('../dist/http-limits');
const { createGateTestConfig } = require('./gate-test-config.cjs');

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const AUDIENCE = 'ticket-api';
const RESOLVE_BUCKET = 'redemption.resolve';

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'fe715-resolve-rls-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'fe715-resolve-credential-key!!';
const RAW_CODE = 'FE715-RESOLVE-A';

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

function isRateLimitWithoutTenantContext(err) {
  const msg = String(err?.message ?? '') + String(err?.meta?.message ?? '');
  const pgCode = String(err?.meta?.code ?? '');
  return (
    msg.includes('row-level security') ||
    pgCode === '42501' ||
    msg.includes('42501') ||
    msg.includes('22P02')
  );
}

async function localVerifier() {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  const verifier = createOidcVerifier(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: 'https://jwks.test.local/jwks.json',
    },
    { jwks: createLocalJwks(publicJwk) },
  );
  return { privateKey, verifier };
}

async function sign(privateKey, subject) {
  return new jose.SignJWT({
    email: 'attendee@example.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

async function startIsolatedPostgres() {
  const name = 'ticket-api-resolve-rls-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=resolve_rls_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker(
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'resolve_rls_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'postgres must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/resolve_rls_test',
  });
  await admin.connect();
  await admin.query(
    'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query(
    'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query(
    'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of MIGRATIONS) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE resolve_rls_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO resolve_rls_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://resolve_rls_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/resolve_rls_test',
  };
}

function testEnv(gateKey) {
  return {
    ...process.env,
    SINGLE_CODE_RESOLVE_GLOBAL: '1',
    CODE_HMAC_PEPPER: 'fe715-resolve-rls-pepper!!',
    CODE_HMAC_VERSION: '1',
    TICKET_CREDENTIAL_KEY: CRED_KEY,
    REDEMPTION_RESOLVE_TOKEN_SECRET: CRED_KEY,
    ...gateKey.env,
  };
}

async function saturateBucket(db, userId, bucketKey, limit) {
  const window = new Date();
  window.setUTCMinutes(0, 0, 0);
  await withTenant(db, userId, async (tx) => {
    // Cover a UTC boundary between fixture setup and the injected request.
    for (const windowStartedAt of [
      window,
      new Date(window.getTime() + 3_600_000),
    ]) {
      await tx.notificationRateCounter.upsert({
        where: {
          tenantId_bucketKey_windowStartedAt: {
            tenantId: userId,
            bucketKey,
            windowStartedAt,
          },
        },
        create: { tenantId: userId, bucketKey, windowStartedAt, count: limit },
        update: { count: limit },
      });
    }
  });
}

async function businessState(db, tenantId) {
  return withTenant(
    db,
    tenantId,
    (tx) =>
      tx.$queryRaw`
      SELECT
        (SELECT count(*)::integer FROM tickets) AS tickets,
        (SELECT count(*)::integer FROM redemption_requests) AS requests,
        (SELECT count(*)::integer FROM operations) AS operations,
        (SELECT coalesce(jsonb_agg(jsonb_build_array(status, active_request_id) ORDER BY id), '[]'::jsonb) FROM redemption_codes) AS codes,
        (SELECT count(*)::integer FROM event_attendees) AS attendees,
        (SELECT coalesce(sum(issued_count), 0)::integer FROM attendee_counters) AS issued_count,
        (SELECT count(*)::integer FROM checkin_reservations) AS reservations,
        (SELECT count(*)::integer FROM checkins) AS checkins,
        (SELECT count(*)::integer FROM offline_sync_events) AS offline_events,
        (SELECT count(*)::integer FROM audit_logs) AS audits,
        (SELECT count(*)::integer FROM outbox) AS outbox,
        (SELECT coalesce(sum(allocated), 0)::integer FROM quota_buckets) AS allocated
    `,
  );
}

test(
  'resolve rate limit and API endpoint matrix: RLS, user buckets, 429, no business mutation',
  { timeout: 300000 },
  async () => {
    let container;
    let db;
    const { privateKey, verifier } = await localVerifier();
    const gateKey = createGateTestConfig(CRED_KEY, 'fe715-gate-test-kid');
    try {
      const boot = await startIsolatedPostgres();
      container = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);

      const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

      const userA = await users.upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: 'fe715-actor-a',
        email: 'a@example.com',
        emailVerified: true,
      });
      const userB = await users.upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: 'fe715-actor-b',
        email: 'b@example.com',
        emailVerified: true,
      });

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'fe715', name: 'FE715 Tenant' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'fe715-event',
            name: 'FE715 Event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: [RAW_CODE],
        });
        await backfillCodeRoutingFromRedemptionCodes(tx);
      });

      try {
        await db.$transaction((tx) =>
          tryConsumeRateLimit(tx, {
            tenantId: userA.userId,
            bucketKey: RESOLVE_BUCKET,
            limit: 30,
          }),
        );
        assert.fail(
          'tryConsumeRateLimit without app.tenant_id must fail closed',
        );
      } catch (err) {
        assert.ok(
          isRateLimitWithoutTenantContext(err),
          'expected RLS/tenant-context failure, got: ' + err,
        );
      }

      const firstA = await withTenant(db, userA.userId, (tx) =>
        tryConsumeRateLimit(tx, {
          tenantId: userA.userId,
          bucketKey: RESOLVE_BUCKET,
          limit: 1,
        }),
      );
      assert.equal(firstA, true);

      const secondA = await withTenant(db, userA.userId, (tx) =>
        tryConsumeRateLimit(tx, {
          tenantId: userA.userId,
          bucketKey: RESOLVE_BUCKET,
          limit: 1,
        }),
      );
      assert.equal(secondA, false, 'actor A at limit');

      const firstB = await withTenant(db, userB.userId, (tx) =>
        tryConsumeRateLimit(tx, {
          tenantId: userB.userId,
          bucketKey: RESOLVE_BUCKET,
          limit: 1,
        }),
      );
      assert.equal(firstB, true, 'actor B counter independent of A');

      const app = await createApp({
        logging: false,
        oidcVerifier: verifier,
        users,
        database: db,
        env: testEnv(gateKey),
        hmac: HMAC,
        credentialKey: CRED_KEY,
      });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      const unauth = await app.inject({
        method: 'POST',
        url: '/v1/redemptions/resolve',
        payload: { code: RAW_CODE },
      });
      assert.equal(unauth.statusCode, 401);

      const token = await sign(privateKey, 'fe715-actor-a');
      const resolved = await app.inject({
        method: 'POST',
        url: '/v1/redemptions/resolve',
        headers: { authorization: 'Bearer ' + token },
        payload: { code: RAW_CODE },
      });
      assert.notEqual(
        resolved.statusCode,
        500,
        'resolve must not 500 on rate-limit RLS',
      );
      assert.ok(
        resolved.statusCode === 200 || resolved.statusCode === 201,
        'expected 2xx resolve response',
      );
      const body = resolved.json();
      assert.equal(body.tenantId, tenantId);
      assert.equal(body.eventId, eventId);
      assert.ok(body.resolveToken);

      const auth = { authorization: 'Bearer ' + token };
      const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const gateJws = await signGateCredentialJws({
        claims: { tid: tenantId, eid: eventId, tkt: uuid, ver: 1 },
        privateKeyPem: gateKey.privateKeyPem,
        kid: gateKey.kid,
      });
      const rateCases = [
        {
          name: 'global resolve',
          bucket: RESOLVE_BUCKET,
          limit: 30,
          controlStatus: 201,
          request: {
            method: 'POST',
            url: '/v1/redemptions/resolve',
            payload: { code: RAW_CODE },
          },
        },
        {
          name: 'redeem',
          bucket: API_RATE_BUCKETS.redeem,
          limit: API_RATE_LIMITS.redeemPerUser,
          controlStatus: 409,
          controlCode: 'FORM_VERSION_STALE',
          request: {
            method: 'POST',
            url: `/v1/tenants/${tenantId}/events/${eventId}/redemptions`,
            headers: { 'idempotency-key': uuid },
            payload: {
              code: RAW_CODE,
              formVersion: 'v1',
              termsVersion: 'v1',
              answers: {},
            },
          },
        },
        {
          name: 'Gate reserve',
          bucket: API_RATE_BUCKETS.gateReserve,
          limit: API_RATE_LIMITS.gateReservePerUser,
          controlStatus: 403,
          controlCode: 'MEMBERSHIP_REQUIRED',
          request: {
            method: 'POST',
            url: `/v1/gate/events/${eventId}/reservations`,
            payload: {
              tenantId,
              staffSessionId: uuid,
              presented: { kind: 'qr', jws: gateJws },
            },
          },
        },
        {
          name: 'Gate confirm',
          bucket: API_RATE_BUCKETS.gateConfirm,
          limit: API_RATE_LIMITS.gateConfirmPerUser,
          controlStatus: 403,
          controlCode: 'MEMBERSHIP_REQUIRED',
          request: {
            method: 'POST',
            url: `/v1/gate/events/${eventId}/reservations/${uuid}/confirm`,
            payload: { tenantId, staffSessionId: uuid, token: 'fixture-token' },
          },
        },
        {
          name: 'Gate offline sync',
          bucket: API_RATE_BUCKETS.gateOfflineSync,
          limit: API_RATE_LIMITS.gateOfflineSyncPerUser,
          controlStatus: 403,
          controlCode: 'MEMBERSHIP_REQUIRED',
          request: {
            method: 'POST',
            url: `/v1/gate/events/${eventId}/offline-sync`,
            payload: {
              tenantId,
              staffSessionId: uuid,
              deviceId: uuid,
              clientClockAt: new Date().toISOString(),
              events: [],
            },
          },
        },
        {
          name: 'Gate receipt',
          bucket: API_RATE_BUCKETS.gateOfflineSyncReceipt,
          limit: API_RATE_LIMITS.gateOfflineSyncReceiptPerUser,
          controlStatus: 403,
          controlCode: 'MEMBERSHIP_REQUIRED',
          request: {
            method: 'GET',
            url: `/v1/gate/events/${eventId}/offline-sync/receipts/${uuid}?tenantId=${tenantId}`,
          },
        },
      ];
      const bucketKeys = rateCases.map(({ bucket }) => bucket);
      for (const {
        name,
        bucket,
        limit,
        controlStatus,
        controlCode,
        request,
      } of rateCases) {
        await withTenant(db, userA.userId, (tx) =>
          tx.notificationRateCounter.updateMany({
            where: { tenantId: userA.userId, bucketKey: { in: bucketKeys } },
            data: { count: 0 },
          }),
        );
        const control = await app.inject({
          ...request,
          headers: { ...request.headers, ...auth },
        });
        assert.equal(
          control.statusCode,
          controlStatus,
          `${name} control response`,
        );
        if (controlCode) assert.equal(control.json().code, controlCode, name);
        const controlCounters = await withTenant(db, userA.userId, (tx) =>
          tx.notificationRateCounter.findMany({
            where: { tenantId: userA.userId, bucketKey: { in: bucketKeys } },
          }),
        );
        assert.equal(
          controlCounters.filter(
            (counter) => counter.bucketKey === bucket && counter.count === 1,
          ).length,
          1,
          `${name} control must advance only its own bucket`,
        );
        assert.ok(
          controlCounters.every(
            (counter) =>
              counter.count === 0 ||
              (counter.bucketKey === bucket && counter.count === 1),
          ),
          `${name} control must advance only its own bucket`,
        );

        await saturateBucket(db, userA.userId, bucket, limit);
        const before = await businessState(db, tenantId);
        const denied = await app.inject({
          ...request,
          headers: { ...request.headers, ...auth },
        });
        assert.equal(denied.statusCode, 429, name);
        assert.equal(denied.json().code, 'RATE_LIMITED', name);
        assert.equal(denied.json().retryable, true, name);
        assert.match(denied.json().requestId, /^[0-9a-f-]{36}$/i, name);
        assert.deepEqual(
          await businessState(db, tenantId),
          before,
          `${name} must not consume business state`,
        );
        const counters = await withTenant(db, userA.userId, (tx) =>
          tx.notificationRateCounter.findMany({
            where: { tenantId: userA.userId, bucketKey: { in: bucketKeys } },
          }),
        );
        const rejectedBucket = counters.filter(
          (counter) => counter.bucketKey === bucket,
        );
        assert.equal(rejectedBucket.length, 2, name);
        assert.ok(
          rejectedBucket.every((counter) => counter.count === limit),
          `${name} must not advance a rejected bucket`,
        );
        assert.ok(
          counters.every(
            (counter) => counter.bucketKey === bucket || counter.count === 0,
          ),
          `${name} must leave all other buckets below cap`,
        );
      }

      const beforeOtherActor = await businessState(db, tenantId);
      const tokenB = await sign(privateKey, 'fe715-actor-b');
      const otherActor = await app.inject({
        method: 'POST',
        url: '/v1/redemptions/resolve',
        headers: { authorization: 'Bearer ' + tokenB },
        payload: { code: RAW_CODE },
      });
      assert.equal(
        otherActor.statusCode,
        201,
        'another user keeps an independent resolve bucket',
      );
      assert.deepEqual(await businessState(db, tenantId), beforeOtherActor);

      await app.close();
    } finally {
      if (db) await db.$disconnect();
      if (container) {
        try {
          docker('rm', '-f', container);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
