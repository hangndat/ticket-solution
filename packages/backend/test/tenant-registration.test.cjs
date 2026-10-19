const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  bootstrapPlatformOperator,
  registerPendingTenant,
  setTenantStatus,
  assertTenantAllowsAdminMutation,
  createEvent,
  withTenant,
  lockTenantPolicyForShare,
  listPlatformTenants,
  listMyTenants,
  PLATFORM_ERROR_CODES,
  SELF_SERVE_DEFAULT_LIMITS,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name, 'migration.sql'));
}

async function startIsolatedPostgres() {
  const name = 'ticket-reg-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=reg_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
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
        'reg_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!ready) throw new Error('postgres not ready');
  const port = docker('port', name, '5432/tcp').split(':').pop();
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/reg_test',
  });
  for (let i = 0; i < 30; i++) {
    try {
      await admin.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
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
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE reg_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO reg_login');
  await admin.query('GRANT ticket_platform_runtime TO reg_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://reg_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/reg_test',
  };
}

test(
  'P2 self-serve PENDING registration — abuse, isolation, Operator ACTIVE',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);
      const users = createPrismaIdentityUserRepository(db);

      const lead = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'lead-1',
        email: 'lead@example.com',
        emailVerified: true,
      });
      const unverified = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'lead-unverified',
        email: 'unverified@example.com',
        emailVerified: false,
      });
      const operator = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'op-reg-1',
        email: 'op-reg@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      await assert.rejects(
        () =>
          registerPendingTenant(db, {
            actorUserId: unverified.userId,
            email: 'unverified@example.com',
            emailVerified: false,
            clientKey: 'idem-unverified-01',
            body: { slug: 'nope', name: 'Nope' },
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );

      const created = await registerPendingTenant(db, {
        actorUserId: lead.userId,
        email: 'lead@example.com',
        emailVerified: true,
        clientKey: 'idem-reg-01',
        body: {
          slug: 'acme-self',
          name: 'Acme Self Serve',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
        },
        config: {
          rateWindowSeconds: 3600,
          rateMax: 3,
          maxPendingOwned: 2,
        },
      });
      assert.equal(created.status, 'PENDING');
      assert.ok(created.registrationId);
      assert.ok(created.tenantId);
      assert.equal('rawInviteToken' in created, false);
      assert.equal('ownerInviteId' in created, false);

      const replay = await registerPendingTenant(db, {
        actorUserId: lead.userId,
        email: 'lead@example.com',
        emailVerified: true,
        clientKey: 'idem-reg-01',
        body: {
          slug: 'acme-self',
          name: 'Acme Self Serve',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
        },
        config: {
          rateWindowSeconds: 3600,
          rateMax: 3,
          maxPendingOwned: 2,
        },
      });
      assert.equal(replay.tenantId, created.tenantId);
      assert.equal(replay.registrationId, created.registrationId);

      await assert.rejects(
        () =>
          registerPendingTenant(db, {
            actorUserId: lead.userId,
            email: 'lead@example.com',
            emailVerified: true,
            clientKey: 'idem-reg-01',
            body: {
              slug: 'acme-other',
              name: 'Different payload',
            },
            config: {
              rateWindowSeconds: 3600,
              rateMax: 3,
              maxPendingOwned: 2,
            },
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      );

      const policy = await withTenant(db, created.tenantId, (tx) =>
        lockTenantPolicyForShare(tx, created.tenantId),
      );
      assert.equal(policy.status, 'PENDING');
      assert.equal(policy.version, 1);

      await assert.rejects(
        () =>
          withTenant(db, created.tenantId, (tx) =>
            createEvent(tx, {
              tenantId: created.tenantId,
              actorUserId: lead.userId,
              idempotencyKey: randomUUID(),
              body: {
                slug: 'blocked',
                name: 'Blocked',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            }),
          ),
        (e) => e.code === PLATFORM_ERROR_CODES.TENANT_PENDING,
      );

      const mine = await listMyTenants(db, lead.userId);
      assert.ok(mine.some((t) => t.tenantId === created.tenantId));

      const queue = await listPlatformTenants(db, {
        actorUserId: operator.userId,
        limit: 50,
      });
      const row = queue.items.find((t) => t.tenantId === created.tenantId);
      assert.ok(row);
      assert.equal(row.status, 'PENDING');
      assert.equal(row.slug, 'acme-self');

      const activated = await setTenantStatus(db, {
        actorUserId: operator.userId,
        tenantId: created.tenantId,
        status: 'ACTIVE',
        reason: 'ops approve self-serve',
        expectedVersion: 1,
      });
      assert.equal(activated.status, 'ACTIVE');

      await withTenant(db, created.tenantId, async (tx) => {
        const after = await lockTenantPolicyForShare(tx, created.tenantId);
        assertTenantAllowsAdminMutation(after.status);
        const ev = await createEvent(tx, {
          tenantId: created.tenantId,
          actorUserId: lead.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'first',
            name: 'First Event',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
        assert.ok(ev.event.eventId);
      });

      // Rate / pending-owned abuse (tight caps)
      const lead2 = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'lead-2',
        email: 'lead2@example.com',
        emailVerified: true,
      });
      await registerPendingTenant(db, {
        actorUserId: lead2.userId,
        email: 'lead2@example.com',
        emailVerified: true,
        clientKey: 'idem-rate-a',
        body: { slug: 'rate-a', name: 'Rate A' },
        config: {
          rateWindowSeconds: 3600,
          rateMax: 1,
          maxPendingOwned: 1,
        },
      });
      await assert.rejects(
        () =>
          registerPendingTenant(db, {
            actorUserId: lead2.userId,
            email: 'lead2@example.com',
            emailVerified: true,
            clientKey: 'idem-rate-b',
            body: { slug: 'rate-b', name: 'Rate B' },
            config: {
              rateWindowSeconds: 3600,
              rateMax: 1,
              maxPendingOwned: 1,
            },
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RATE_LIMITED,
      );

      assert.equal(SELF_SERVE_DEFAULT_LIMITS.maxEvents, 2);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
