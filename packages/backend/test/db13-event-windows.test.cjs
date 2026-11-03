// DB-13 — event windows are independent per event, validated against IANA
// timezone and UTC instants, and the redemption/check-in deadline is a DB
// clock compared against DB-read bounds (half-open [opensAt, closesAt)).
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
  getEvent,
  isWindowOpen,
  EventError,
  EVENT_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

async function startIsolatedPostgres() {
  const name = 'ticket-db13-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_2427dc28858c',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db13_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'db13_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/db13_test',
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
      "CREATE ROLE db13_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO db13_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://db13_login:' + password + '@127.0.0.1:' + port + '/db13_test',
  };
}

test('DB-13: isWindowOpen is half-open with null bounds unbounded', () => {
  const t0 = new Date('2026-11-01T10:00:00.000Z');
  const t1 = new Date('2026-11-01T11:00:00.000Z');
  const t2 = new Date('2026-11-01T12:00:00.000Z');
  // null bounds → unbounded on that side
  assert.equal(isWindowOpen(t0, null, null), true);
  assert.equal(isWindowOpen(t0, null, t2), true);
  assert.equal(isWindowOpen(t0, t0, null), true);
  // half-open [t1, t2): opensAt inclusive, closesAt exclusive
  assert.equal(isWindowOpen(t0, t1, t2), false); // before open
  assert.equal(isWindowOpen(t1, t1, t2), true); // exactly at open
  assert.equal(isWindowOpen(new Date('2026-11-01T11:59:59.999Z'), t1, t2), true);
  assert.equal(isWindowOpen(t2, t1, t2), false); // exactly at close → closed
  assert.equal(isWindowOpen(new Date('2026-11-01T12:00:00.001Z'), t1, t2), false);
});

test(
  'DB-13: two IANA timezones stored independently; invalid timezone/window rejected',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);

      const users = createPrismaIdentityUserRepository(db);
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'db13-manager',
        email: 'db13-manager@example.com',
        emailVerified: true,
      });

      const tenantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db13-windows', name: 'Windows' },
        });
        await grantMembership(tx, {
          tenantId,
          userId: manager.userId,
          role: 'MANAGER',
          permissions: ['event.create', 'event.update'],
        });
      });

      // Two events in different IANA timezones, windows in UTC instants.
      const asia = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'asia-window',
            name: 'Asia Window',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
            startsAt: '2026-11-01T10:00:00.000Z',
            endsAt: '2026-11-01T18:00:00.000Z',
            redemptionOpensAt: '2026-10-01T00:00:00.000Z',
            redemptionClosesAt: '2026-12-01T00:00:00.000Z',
          },
        }),
      );
      const ny = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'ny-window',
            name: 'NY Window',
            timezone: 'America/New_York',
            visibility: 'UNLISTED',
            startsAt: '2026-11-02T10:00:00.000Z',
            endsAt: '2026-11-02T18:00:00.000Z',
            redemptionOpensAt: '2026-11-01T00:00:00.000Z',
            redemptionClosesAt: '2026-11-03T00:00:00.000Z',
          },
        }),
      );
      assert.equal(asia.event.timezone, 'Asia/Ho_Chi_Minh');
      assert.equal(ny.event.timezone, 'America/New_York');
      assert.notEqual(asia.event.eventId, ny.event.eventId);

      const readAsia = await withTenant(db, tenantId, (tx) =>
        getEvent(tx, {
          tenantId,
          eventId: asia.event.eventId,
          actorUserId: manager.userId,
        }),
      );
      assert.equal(readAsia.timezone, 'Asia/Ho_Chi_Minh');

      // Invalid IANA timezone → INVALID_TIMEZONE.
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            createEvent(tx, {
              tenantId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: { slug: 'bad-tz', name: 'Bad TZ', timezone: 'Not/AZone' },
            }),
          ),
        (e) => e instanceof EventError && e.code === EVENT_ERROR_CODES.INVALID_TIMEZONE,
      );

      // Window order (closesAt <= opensAt) → INVALID_WINDOW.
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            createEvent(tx, {
              tenantId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: {
                slug: 'bad-window',
                name: 'Bad Window',
                timezone: 'UTC',
                startsAt: '2026-11-01T18:00:00.000Z',
                endsAt: '2026-11-01T10:00:00.000Z',
              },
            }),
          ),
        (e) => e instanceof EventError && e.code === EVENT_ERROR_CODES.INVALID_WINDOW,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore cleanup races */
        }
      }
    }
  },
);
