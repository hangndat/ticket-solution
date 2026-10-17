const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  grantMembership,
  grantEventAssignment,
  GateError,
  GATE_ERROR_CODES,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  undoCheckin,
  revokeTicket,
  revokeStaffSession,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = [
  '202610160001_foundation',
  '202610160002_d1_users',
  '202610160003_d1_membership',
  '202610160004_d2_issue_ticket',
  '202610170005_d3_gate',
  '202610170006_d4_config_publish',
  '202610170010_e_be_event_lifecycle',
].map((name) =>
  path.join(__dirname, '../prisma/migrations', name, 'migration.sql'),
);

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd3-gate-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startIsolatedPostgres() {
  const name = 'ticket-d3-gate-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=d3_gate_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'd3_gate_test');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'task database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d3_gate_test',
  });
  try {
  for (let i = 0; i < 30; i++) {
    try {
      await admin.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of MIGRATIONS) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE d3_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO d3_login');
  return {
    name,
    url: 'postgresql://d3_login:' + password + '@127.0.0.1:' + port + '/d3_gate_test',
  };
  } finally {
    await admin.end().catch(() => {});
  }
}

test(
  'gate: one confirm wins, other session blocked, expiry and revoke',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    let db2;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      db2 = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-a',
        email: 'staff-a@example.com',
        emailVerified: true,
      });
      const staffB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-b',
        email: 'staff-b@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'guest',
        email: 'guest@example.com',
        emailVerified: true,
      });
      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'gate-tenant', name: 'Gate' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'gate-event',
            name: 'Gate Event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['GATE-CODE', 'GATE-REVOKE'],
        });
        for (const userId of [staff.userId, staffB.userId]) {
          const membership = await grantMembership(tx, {
            tenantId,
            userId,
            role: 'STAFF',
            permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
          });
        }
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd3-cred-key', {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'GATE-CODE',
            idempotencyKey: randomUUID(),
          }),
        ),
      );

      const session = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staff.userId }),
      );
      const other = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staffB.userId }),
      );
      const hold = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: issued.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            reserveCheckin(tx, {
              tenantId,
              eventId,
              ticketId: issued.ticketId,
              staffSessionId: other.sessionId,
              actorUserId: staffB.userId,
            }),
          ),
        (error) =>
          error instanceof GateError &&
          error.code === GATE_ERROR_CODES.HELD_BY_OTHER_SESSION,
      );

      const raced = await Promise.allSettled([
        withTenant(db, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            token: hold.token,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
        withTenant(db2, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            token: hold.token,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      ]);
      const wins = raced.filter((r) => r.status === 'fulfilled');
      const losses = raced.filter((r) => r.status === 'rejected');
      assert.equal(wins.length, 1);
      assert.equal(losses.length, 1);
      assert.equal(losses[0].reason.code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
      const counts = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM checkins WHERE undone_at IS NULL`,
      );
      assert.equal(counts[0].n, 1);

      const undone = await withTenant(db, tenantId, (tx) =>
        undoCheckin(tx, {
          tenantId,
          eventId,
          checkinId: wins[0].value.checkinId,
          actorUserId: staff.userId,
          reason: 'khách vào nhầm cổng',
        }),
      );
      assert.equal(undone.state, 'ACTIVE');

      const again = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: issued.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      await withTenant(db, tenantId, (tx) =>
        tx.$executeRaw`UPDATE checkin_reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = ${again.reservationId}::uuid`,
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            confirmCheckin(tx, {
              tenantId,
              eventId,
              reservationId: again.reservationId,
              token: again.token,
              staffSessionId: session.sessionId,
              actorUserId: staff.userId,
            }),
          ),
        (error) =>
          error instanceof GateError &&
          error.code === GATE_ERROR_CODES.RESERVATION_EXPIRED,
      );

      const second = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd3-cred-key', {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'GATE-REVOKE',
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      const hold2 = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: second.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      const raceRevoke = await Promise.allSettled([
        withTenant(db, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold2.reservationId,
            token: hold2.token,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
        withTenant(db2, tenantId, (tx) =>
          revokeTicket(tx, {
            tenantId,
            eventId,
            ticketId: second.ticketId,
            actorUserId: staffB.userId,
            reason: 'vé giả',
          }),
        ),
      ]);
      const after = await withTenant(db, tenantId, async (tx) => {
        const state = await tx.$queryRaw`
          SELECT state FROM tickets WHERE id = ${second.ticketId}::uuid
        `;
        const n = await tx.$queryRaw`
          SELECT count(*)::int AS n FROM checkins
          WHERE ticket_id = ${second.ticketId}::uuid AND undone_at IS NULL
        `;
        const audit = await tx.$queryRaw`
          SELECT count(*)::int AS n FROM audit_logs
          WHERE action IN ('gate.confirm', 'ticket.revoke', 'gate.undo')
        `;
        return { state: state[0].state, checkins: n[0].n, audit: audit[0].n };
      });
      assert.ok(after.state === 'USED' || after.state === 'REVOKED');
      if (after.state === 'USED') {
        assert.equal(after.checkins, 1);
        assert.equal(raceRevoke.filter((r) => r.status === 'fulfilled').length, 1);
      } else {
        assert.ok(after.checkins === 0 || after.checkins === 1);
      }
      assert.ok(after.audit >= 2);

      await withTenant(db, tenantId, (tx) =>
        revokeStaffSession(tx, {
          tenantId,
          eventId,
          sessionId: other.sessionId,
          actorUserId: staff.userId,
        }),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            reserveCheckin(tx, {
              tenantId,
              eventId,
              ticketId: issued.ticketId,
              staffSessionId: other.sessionId,
              actorUserId: staffB.userId,
            }),
          ),
        (error) =>
          error instanceof GateError &&
          error.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      );
    } finally {
      if (db) await db.$disconnect();
      if (db2) await db2.$disconnect();
      if (name) {
        execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
      }
    }
  },
);
