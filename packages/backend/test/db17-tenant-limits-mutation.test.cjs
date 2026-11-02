'use strict';

/**
 * DB-17 (D): tenant limits enforced at mutation + usage reporting.
 * maxEvents caps event creation (count > max throws TENANT_LIMIT_REACHED and the
 * transaction rolls back); maxStaff caps membership invites (active + pending).
 * readTenantLimitsUsage reflects the committed counts on the DB clock.
 * Isolated Docker Postgres; runtime role (no BYPASSRLS).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  bootstrapPlatformOperator,
  provisionTenant,
  acceptMembershipInvite,
  createMembershipInvite,
  createEvent,
  readTenantLimitsUsage,
  readPlatformSecurityConfig,
  withTenant,
  PLATFORM_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-db17-limits-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db17_limits_test',
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
        'db17_limits_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready);
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db17_limits_test',
  });
  for (let i = 0; i < 30; i++) {
    try {
      await admin.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query(
    'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE db17_limits_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO db17_limits_login');
  await admin.query('GRANT ticket_platform_runtime TO db17_limits_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://db17_limits_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db17_limits_test',
  };
}

test(
  'DB-17: maxEvents/maxStaff enforced at mutation; usage reflects committed counts',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 6);
      const users = createPrismaIdentityUserRepository(db);
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });
      const issuer = 'http://localhost/realms/ticket';

      const operator = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'op-db17-limits',
        email: 'op-limits@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner-db17-limits',
        email: 'owner-limits@example.com',
        emailVerified: true,
      });

      const slug = 'db17lim-' + randomBytes(2).toString('hex');
      const tenant = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-db17-limits',
        body: {
          slug,
          name: 'DB17 Limits',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-limits@example.com',
          limits: {
            maxEvents: 2,
            maxStaff: 3,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      await acceptMembershipInvite(db, {
        userId: owner.userId,
        email: 'owner-limits@example.com',
        emailVerified: true,
        token: tenant.rawInviteToken,
      });

      const createEv = (slugValue) =>
        withTenant(db, tenant.tenantId, (tx) =>
          createEvent(tx, {
            tenantId: tenant.tenantId,
            actorUserId: owner.userId,
            idempotencyKey: randomUUID(),
            body: {
              slug: slugValue,
              name: slugValue,
              timezone: 'Asia/Ho_Chi_Minh',
            },
          }),
        );

      // maxEvents = 2: two events fit, the third rolls back entirely.
      const ev1 = await createEv('ev-one-' + randomBytes(2).toString('hex'));
      const ev2 = await createEv('ev-two-' + randomBytes(2).toString('hex'));
      assert.ok(ev1.event.eventId);
      assert.ok(ev2.event.eventId);
      await assert.rejects(
        () => createEv('ev-three-' + randomBytes(2).toString('hex')),
        (e) => e.code === PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
      );
      const eventCount = await withTenant(db, tenant.tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM events WHERE tenant_id = ${tenant.tenantId}::uuid`,
      );
      assert.equal(eventCount[0].n, 2, 'failed create must roll back');

      // maxStaff = 3 (owner + 2 invites): third invite rejected, none created.
      const invite = (email) =>
        createMembershipInvite(db, security, {
          tenantId: tenant.tenantId,
          actorUserId: owner.userId,
          email,
          role: 'Manager',
          clientKey: 'inv-' + randomUUID(),
        });
      await invite('staff1@example.com');
      await invite('staff2@example.com');
      await assert.rejects(
        () => invite('staff3@example.com'),
        (e) => e.code === PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
      );

      const usage = await readTenantLimitsUsage(
        db,
        tenant.tenantId,
        owner.userId,
      );
      assert.equal(usage.limits.maxEvents, 2);
      assert.equal(usage.limits.maxStaff, 3);
      assert.equal(usage.usage.events, 2);
      assert.equal(usage.usage.staffActive, 1, 'owner only is activated');
      assert.equal(usage.usage.staffPendingInvites, 2, 'two pending invites');

      // Deterministic race: maxEvents=1, two concurrent creates. The
      // `FOR UPDATE` lock on tenant_limits (event-tenant-guards.ts) serializes
      // the two transactions, so exactly one commits and the other rolls back
      // with TENANT_LIMIT_REACHED — no oversell under concurrency.
      const raceOwner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner-db17-race',
        email: 'owner-race@example.com',
        emailVerified: true,
      });
      const raceTenant = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-db17-race',
        body: {
          slug: 'db17race-' + randomBytes(2).toString('hex'),
          name: 'DB17 Limits Race',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-race@example.com',
          limits: {
            maxEvents: 1,
            maxStaff: 10,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      await acceptMembershipInvite(db, {
        userId: raceOwner.userId,
        email: 'owner-race@example.com',
        emailVerified: true,
        token: raceTenant.rawInviteToken,
      });
      const createRaceEv = (slugValue) =>
        withTenant(db, raceTenant.tenantId, (tx) =>
          createEvent(tx, {
            tenantId: raceTenant.tenantId,
            actorUserId: raceOwner.userId,
            idempotencyKey: randomUUID(),
            body: {
              slug: slugValue,
              name: slugValue,
              timezone: 'Asia/Ho_Chi_Minh',
            },
          }),
        );
      const [raceA, raceB] = await Promise.allSettled([
        createRaceEv('ev-race-a-' + randomBytes(2).toString('hex')),
        createRaceEv('ev-race-b-' + randomBytes(2).toString('hex')),
      ]);
      const settled = [raceA, raceB];
      const fulfilled = settled.filter((r) => r.status === 'fulfilled');
      const rejected = settled.filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 1, 'exactly one concurrent create must win');
      assert.equal(rejected.length, 1, 'exactly one concurrent create must lose');
      assert.equal(
        rejected[0].reason.code,
        PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
      );
      const raceCount = await withTenant(db, raceTenant.tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM events WHERE tenant_id = ${raceTenant.tenantId}::uuid`,
      );
      assert.equal(raceCount[0].n, 1, 'no oversell under concurrency');
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
