const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  withActor,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  listTicketsForOwner,
  listAllTicketsForOwner,
  listOwnerTicketsAggregated,
  readCodeHmacEnvironment,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'w1-aggregate-test-pepper',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'w1-aggregate-test-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-w1-agg-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=w1_agg_test',
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
        'w1_agg_test',
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
      '/w1_agg_test',
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
    "CREATE ROLE w1_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO w1_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://w1_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/w1_agg_test',
  };
}

async function seedTenantEvent(db, tenantId, eventId, slug) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'tenant-' + slug, name: 'T ' + slug },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug,
        name: 'Event ' + slug,
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
  'W1: owner aggregate lists all tenants; RLS isolates other owners; tenant filter unchanged',
  { timeout: 240000 },
  async () => {
    let container;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      container = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const userA = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_a',
        email: 'a@example.com',
        emailVerified: true,
      });
      const userB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_b',
        email: 'b@example.com',
        emailVerified: true,
      });

      const T1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const T2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const E1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const E2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      await seedTenantEvent(db, T1, E1, 'one');
      await seedTenantEvent(db, T2, E2, 'two');
      await withTenant(db, T1, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E1,
          eventQuota: 5,
          rawCodes: ['CODE-one-b'],
        });
      });

      const ticketA1 = await withTenant(db, T1, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: userA.userId,
          actorEmail: userA.email,
          emailVerified: true,
          rawCode: 'CODE-one',
          idempotencyKey: randomUUID(),
        });
        return unwrapRedeemOutcome(outcome);
      });
      const ticketA2 = await withTenant(db, T2, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T2,
          eventId: E2,
          actorUserId: userA.userId,
          actorEmail: userA.email,
          emailVerified: true,
          rawCode: 'CODE-two',
          idempotencyKey: randomUUID(),
        });
        return unwrapRedeemOutcome(outcome);
      });
      await withTenant(db, T1, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: userB.userId,
          actorEmail: userB.email,
          emailVerified: true,
          rawCode: 'CODE-one-b',
          idempotencyKey: randomUUID(),
        });
        unwrapRedeemOutcome(outcome);
      });

      const aggregate = await listOwnerTicketsAggregated(db, userA.userId);
      const ids = aggregate.map((t) => t.ticketId).sort();
      assert.deepEqual(ids, [ticketA1.ticketId, ticketA2.ticketId].sort());
      const tenants = new Set(aggregate.map((t) => t.tenantId));
      assert.equal(tenants.size, 2);
      assert.ok(tenants.has(T1));
      assert.ok(tenants.has(T2));

      const bView = await listOwnerTicketsAggregated(db, userB.userId);
      assert.equal(bView.length, 1);
      assert.equal(bView[0].tenantId, T1);
      assert.ok(
        !bView.some((t) => t.ticketId === ticketA1.ticketId || t.ticketId === ticketA2.ticketId),
      );

      const t1Only = await withTenant(db, T1, (tx) =>
        listTicketsForOwner(tx, T1, userA.userId),
      );
      assert.equal(t1Only.length, 1);
      assert.equal(t1Only[0].ticketId, ticketA1.ticketId);

      const crossLeak = await withActor(db, userB.userId, (tx) =>
        listAllTicketsForOwner(tx, userA.userId),
      );
      assert.equal(crossLeak.length, 0);

      const roles =
        await db.$queryRaw`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      assert.equal(roles[0].rolbypassrls, false);
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
