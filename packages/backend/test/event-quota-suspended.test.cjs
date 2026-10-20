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
  createPrismaIdentityUserRepository,
  grantMembership,
  createEvent,
  updateEvent,
  cloneEvent,
  PlatformError,
  PLATFORM_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

async function startIsolatedPostgres() {
  const name = 'ticket-e-be-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_622_event_quota',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=e_be_test',
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
        'e_be_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/e_be_test',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE e_be_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO e_be_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://e_be_login:' + password + '@127.0.0.1:' + port + '/e_be_test',
  };
}

test(
  '#622 max_events replay and SUSPENDED blocks clone/update',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'mgr-622',
        email: 'mgr622@example.com',
        emailVerified: true,
      });

      const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'quota-622', name: 'Quota 622' },
        });
        await tx.$executeRaw`
          INSERT INTO tenant_limits (tenant_id, max_events)
          VALUES (${tenantId}::uuid, 1)
          ON CONFLICT (tenant_id) DO UPDATE SET max_events = 1
        `;
        await grantMembership(tx, {
          tenantId,
          userId: manager.userId,
          role: 'MANAGER',
          permissions: ['event.create', 'event.update', 'event.config'],
        });
      });

      const createKey = randomUUID();
      const body = {
        slug: 'only-one',
        name: 'Only One',
        timezone: 'Asia/Ho_Chi_Minh',
        visibility: 'UNLISTED',
      };
      const created = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body,
        }),
      );
      assert.equal(created.replayed, false);

      const replay = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body,
        }),
      );
      assert.equal(replay.replayed, true);
      assert.equal(replay.event.eventId, created.event.eventId);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            createEvent(tx, {
              tenantId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: { ...body, slug: 'second-event', name: 'Second' },
            }),
          ),
        (err) =>
          err instanceof PlatformError &&
          err.code === PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
      );

      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE tenants SET status = 'SUSPENDED' WHERE id = ${tenantId}::uuid
        `;
      });

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            updateEvent(tx, {
              tenantId,
              eventId: created.event.eventId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: { expectedRevision: 1, name: 'Renamed' },
            }),
          ),
        (err) =>
          err instanceof PlatformError &&
          err.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED,
      );

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            cloneEvent(tx, {
              tenantId,
              sourceEventId: created.event.eventId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: { slug: 'clone-blocked', name: 'Clone Blocked' },
            }),
          ),
        (err) =>
          err instanceof PlatformError &&
          err.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED,
      );
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
