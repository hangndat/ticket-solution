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
  backfillCodeRoutingFromRedemptionCodes,
} = require('@ticket/backend');
const {
  migrationFiles,
} = require('../../../packages/backend/test/migration-files.cjs');
const { createApp } = require('../dist/app');

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
  const msg =
    String(err?.message ?? '') + String(err?.meta?.message ?? '');
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

function testEnv() {
  return {
    ...process.env,
    SINGLE_CODE_RESOLVE_GLOBAL: '1',
    CODE_HMAC_PEPPER: 'fe715-resolve-rls-pepper!!',
    CODE_HMAC_VERSION: '1',
    TICKET_CREDENTIAL_KEY: CRED_KEY,
    REDEMPTION_RESOLVE_TOKEN_SECRET: CRED_KEY,
  };
}

test(
  'resolve rate limit: RLS requires tenant context; actors isolated; HTTP resolve not 500',
  { timeout: 300000 },
  async () => {
    let container;
    let db;
    const { privateKey, verifier } = await localVerifier();
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
        assert.fail('tryConsumeRateLimit without app.tenant_id must fail closed');
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
        env: testEnv(),
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
