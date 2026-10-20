const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
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
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  IDENTITY_ERROR_CODES,
} = require('@ticket/backend');
const {
  migrationFiles,
} = require('../../../packages/backend/test/migration-files.cjs');
const { createApp } = require('../dist/app');

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const AUDIENCE = 'ticket-api';

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

async function sign(privateKey, subject = 'me_tickets_sub') {
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

function memoryUsers() {
  const rows = new Map();
  return {
    async upsertFromVerifiedIdentity(identity) {
      const key = identity.issuer + '\0' + identity.subject;
      const existing = rows.get(key);
      const userId = existing?.userId ?? '22222222-2222-4222-8222-222222222222';
      const stored = {
        userId,
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
      };
      rows.set(key, stored);
      return stored;
    },
  };
}

test('GET /v1/me/tickets auth and tenantId validation', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    env: {
      ...process.env,
      CODE_HMAC_PEPPER: 'api-me-tickets-test-pepper',
      CODE_HMAC_VERSION: '1',
      TICKET_CREDENTIAL_KEY: 'api-me-tickets-cred-key-material',
    },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const unauth = await app.inject({ method: 'GET', url: '/v1/me/tickets' });
    assert.equal(unauth.statusCode, 401);
    assert.equal(unauth.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);

    const token = await sign(privateKey);
    const badTenant = await app.inject({
      method: 'GET',
      url: '/v1/me/tickets?tenantId=not-a-uuid',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(badTenant.statusCode, 422);
    assert.equal(badTenant.json().code, 'INVALID_TENANT');

    const noDb = await app.inject({
      method: 'GET',
      url: '/v1/me/tickets',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(noDb.statusCode, 503);
    assert.equal(noDb.json().code, IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED);
  } finally {
    await app.close();
  }
});

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'api-me-tickets-event-name-pepper',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'api-me-tickets-event-name-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-api-me-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=me_tickets_test',
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
        'me_tickets_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'postgres must become ready');
  const binding = docker('port', name, '5432/tcp');
  const port = binding.split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/me_tickets_test',
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
    "CREATE ROLE me_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO me_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://me_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/me_tickets_test',
  };
}

async function seedTenantEvent(db, tenantId, eventId, slug, eventName) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'tenant-' + slug, name: 'T ' + slug },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug,
        name: eventName,
        status: 'PUBLISHED',
      },
    });
    await seedEventInventory(tx, HMAC, {
      tenantId,
      eventId,
      eventQuota: 5,
      rawCodes: ['CODE-' + slug],
    });
  });
}

test(
  'GET /v1/me/tickets returns eventName for scoped and aggregate listings',
  { timeout: 240000 },
  async () => {
    let container;
    let db;
    const { privateKey, verifier } = await localVerifier();
    try {
      const boot = await startIsolatedPostgres();
      container = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const user = await users.upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: 'me_tickets_event_name',
        email: 'wallet@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const eventName = 'Gala Night 2026';
      await seedTenantEvent(db, tenantId, eventId, 'gala', eventName);

      await withTenant(db, tenantId, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId,
          eventId,
          actorUserId: user.userId,
          actorEmail: user.email,
          emailVerified: true,
          rawCode: 'CODE-gala',
          idempotencyKey: randomUUID(),
        });
        unwrapRedeemOutcome(outcome);
      });

      const app = await createApp({
        logging: false,
        oidcVerifier: verifier,
        users,
        database: db,
        env: {
          ...process.env,
          CODE_HMAC_PEPPER: 'api-me-tickets-event-name-pepper',
          CODE_HMAC_VERSION: '1',
          TICKET_CREDENTIAL_KEY: CRED_KEY,
        },
        hmac: HMAC,
        credentialKey: CRED_KEY,
      });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const token = await sign(privateKey, 'me_tickets_event_name');

      const scoped = await app.inject({
        method: 'GET',
        url: '/v1/me/tickets?tenantId=' + tenantId,
        headers: { authorization: 'Bearer ' + token },
      });
      assert.equal(scoped.statusCode, 200);
      const scopedBody = scoped.json();
      assert.equal(scopedBody.tickets.length, 1);
      assert.equal(scopedBody.tickets[0].eventName, eventName);
      assert.equal(scopedBody.tickets[0].eventId, eventId);

      const aggregate = await app.inject({
        method: 'GET',
        url: '/v1/me/tickets',
        headers: { authorization: 'Bearer ' + token },
      });
      assert.equal(aggregate.statusCode, 200);
      const aggBody = aggregate.json();
      assert.equal(aggBody.tickets.length, 1);
      assert.equal(aggBody.tickets[0].eventName, eventName);

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
