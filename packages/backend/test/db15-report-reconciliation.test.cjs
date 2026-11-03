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
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readEventReport,
  relayOutboxOnce,
  createFailingEmailAdapter,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  undoCheckin,
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  GATE_ERROR_CODES,
  cancelEvent,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd4-report-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'd4-report-credential-key';
const RELAY_OPTS = { credentialKeyMaterial: CREDENTIAL_KEY };

async function startIsolatedPostgres() {
  const name = 'ticket-d4-report-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_99b4f4571376',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d4_report_test',
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
        'd4_report_test',
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d4_report_test',
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
    await admin.query(
      'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS)
      await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d4_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d4_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://d4_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d4_report_test',
  };
}

test(
  'DB-15: report reconciles confirm, reject, undo history, cancellation and final delivery failure',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const actors = {};
      for (const role of ['manager', 'staff', 'attendee']) {
        actors[role] = await users.upsertFromVerifiedIdentity({
          issuer: 'https://identity.example/realms/db15',
          subject: role,
          email: `${role}@example.com`,
          emailVerified: true,
        });
      }
      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db15', name: 'DB15' },
        });
        await tx.$executeRaw`INSERT INTO tenant_limits (tenant_id, email_per_day) VALUES (${tenantId}::uuid, 100)`;
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'db15',
            name: 'DB15',
            status: 'DRAFT',
          },
        });
        const manager = await grantMembership(tx, {
          tenantId,
          userId: actors.manager.userId,
          role: 'MANAGER',
          permissions: ['report.read', 'event.update'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: manager.membershipId,
          permissions: ['report.read', 'event.update'],
        });
        const staff = await grantMembership(tx, {
          tenantId,
          userId: actors.staff.userId,
          role: 'STAFF',
          permissions: ['gate.confirm', 'gate.undo'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: staff.membershipId,
          permissions: ['gate.confirm', 'gate.undo'],
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: ['DB15-A', 'DB15-B'],
        });
      });
      const issue = async (rawCode) =>
        unwrapRedeemOutcome(
          await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
              tenantId,
              eventId,
              actorUserId: actors.attendee.userId,
              actorEmail: actors.attendee.email,
              emailVerified: true,
              rawCode,
              idempotencyKey: randomUUID(),
            }),
          ),
        );
      const first = await issue('DB15-A');
      const usedOnly = await issue('DB15-B');
      await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$executeRaw`UPDATE tickets SET state = 'USED' WHERE tenant_id = ${tenantId}::uuid AND id = ${usedOnly.ticketId}::uuid`,
      );
      const report = () =>
        withTenant(db, tenantId, (tx) =>
          readEventReport(tx, {
            tenantId,
            eventId,
            actorUserId: actors.manager.userId,
          }),
        );
      assert.equal(
        (await report()).checkInSuccessCount,
        0,
        'USED alone is not a confirm',
      );
      const session = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: actors.staff.userId,
        }),
      );
      const reservation = unwrapReserveOutcome(
        await withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: first.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: actors.staff.userId,
          }),
        ),
      );
      const confirmed = unwrapConfirmOutcome(
        await withTenant(db, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: reservation.reservationId,
            token: reservation.token,
            staffSessionId: session.sessionId,
            actorUserId: actors.staff.userId,
          }),
        ),
      );
      const reject = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: first.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: actors.staff.userId,
        }),
      );
      assert.equal(reject.ok, false);
      assert.equal(reject.code, GATE_ERROR_CODES.TICKET_NOT_ACTIVE);
      const confirmedReport = await report();
      assert.equal(confirmedReport.checkInSuccessCount, 1);
      assert.equal(confirmedReport.ticketsByState.USED, 2);
      assert.equal(confirmedReport.rejectByReason.TICKET_NOT_ACTIVE, 1);
      await withTenant(db, tenantId, (tx) =>
        undoCheckin(tx, {
          tenantId,
          eventId,
          checkinId: confirmed.checkinId,
          actorUserId: actors.staff.userId,
          reason: 'DB15 correction',
        }),
      );
      const history = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`SELECT c.id, c.ticket_id, c.undone_at, c.undo_reason, c.undone_by, (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = c.tenant_id AND a.event_id = c.event_id AND a.resource_id = c.id AND a.action = 'gate.undo') AS undo_audits FROM checkins c WHERE c.tenant_id = ${tenantId}::uuid AND c.id = ${confirmed.checkinId}::uuid`,
      );
      assert.equal(history.length, 1);
      assert.equal(history[0].ticket_id, first.ticketId);
      assert.ok(history[0].undone_at);
      assert.equal(history[0].undo_reason, 'DB15 correction');
      assert.equal(history[0].undone_by, actors.staff.userId);
      assert.equal(history[0].undo_audits, 1);
      const undone = await report();
      assert.equal(undone.checkInSuccessCount, 0);
      assert.equal(undone.ticketsByState.USED, 1);
      assert.equal(undone.rejectByReason.TICKET_NOT_ACTIVE, 1);

      const retryConfig = {
        maxAttempts: 2,
        initialBackoffSeconds: 1,
        maxBackoffSeconds: 1,
        jitterRatio: 0,
      };
      const options = { ...RELAY_OPTS, retryConfig };
      await relayOutboxOnce(
        db,
        createFailingEmailAdapter('smtp down'),
        'db15-first',
        10,
        options,
      );
      assert.equal(
        (await report()).emailNeedsCsCount,
        0,
        'retryable failure is not final',
      );
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`UPDATE outbox SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE tenant_id = ${tenantId}::uuid AND status = 'PENDING'`;
        await tx.$executeRaw`UPDATE notifications SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE tenant_id = ${tenantId}::uuid AND state <> 'DEAD'`;
      });
      await relayOutboxOnce(
        db,
        createFailingEmailAdapter('smtp down'),
        'db15-final',
        10,
        options,
      );
      const notes = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`SELECT state, attempts, last_error FROM notifications WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND channel = 'email' ORDER BY id`,
      );
      assert.equal(notes.length, 2);
      assert.deepEqual(
        notes.map(({ state, attempts }) => ({ state, attempts })),
        [
          { state: 'DEAD', attempts: 2 },
          { state: 'DEAD', attempts: 2 },
        ],
      );
      assert.equal((await report()).emailNeedsCsCount, 2);
      const beforeCancel = await report();
      const cancelled = await withTenant(db, tenantId, (tx) =>
        cancelEvent(tx, {
          tenantId,
          eventId,
          actorUserId: actors.manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            expectedRevision: 1,
            reason: 'DB15 cancellation',
            notifyAttendees: false,
          },
        }),
      );
      assert.equal(cancelled.event.businessStatus, 'CANCELLED');
      const afterCancel = await report();
      assert.deepEqual(
        { ...afterCancel, asOf: null },
        { ...beforeCancel, asOf: null },
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* already removed */
        }
      }
    }
  },
);
