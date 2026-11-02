// F04 GATE-02 / GATE-04 / GATE-05 — concurrency on a fresh PostgreSQL.
// Two real connections race the same ticket. The interleaving is not
// controlled, so each case asserts the invariants that must hold for EVERY
// interleaving and records which one happened.
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
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  grantMembership,
  grantEventAssignment,
  GATE_ERROR_CODES,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  cancelReservation,
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  undoCheckin,
  revokeTicket,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'gate-concurrency-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const ROUNDS = 6;
const CODES = Array.from({ length: ROUNDS * 2 + 8 }, (_, i) => `GC-${i}`);

async function startIsolatedPostgres() {
  const name = 'ticket-gate-conc-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=gate_conc_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'gate_conc_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/gate_conc_test',
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
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE gate_conc_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO gate_conc_login');
    return {
      name,
      url: 'postgresql://gate_conc_login:' + password + '@127.0.0.1:' + port + '/gate_conc_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

test(
  'GATE-02/04/05 concurrency: cancel vs confirm/expiry, undo vs scan/revoke',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    let db2;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      db2 = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const mkUser = (subject) =>
        users.upsertFromVerifiedIdentity({
          issuer: ISSUER,
          subject,
          email: `${subject}@example.com`,
          emailVerified: true,
        });
      const staffA = await mkUser('gc-staff-a');
      const staffB = await mkUser('gc-staff-b');
      const guests = [];
      for (let i = 0; i < CODES.length; i++) guests.push(await mkUser(`gc-guest-${i}`));

      const tenantId = 'eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee';
      const eventId = 'ffffffff-2222-4fff-8fff-ffffffffffff';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'gate-conc', name: 'Gate concurrency' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'gate-conc-event',
            name: 'Gate concurrency event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 50,
          rawCodes: CODES,
        });
        const permissions = ['gate.confirm', 'gate.undo', 'ticket.revoke'];
        for (const user of [staffA, staffB]) {
          const membership = await grantMembership(tx, {
            tenantId,
            userId: user.userId,
            role: 'Supervisor',
            permissions,
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions,
          });
        }
      });

      let next = 0;
      const issue = async () => {
        const i = next++;
        return unwrapRedeemOutcome(
          await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, 'gate-conc-cred-key', {
              tenantId,
              eventId,
              actorUserId: guests[i].userId,
              actorEmail: guests[i].email,
              emailVerified: true,
              rawCode: CODES[i],
              idempotencyKey: randomUUID(),
            }),
          ),
        );
      };
      const open = (user) =>
        withTenant(db, tenantId, (tx) =>
          openStaffSession(tx, { tenantId, eventId, userId: user.userId }),
        );
      const sessA = await open(staffA);
      const sessB = await open(staffB);

      const reserve = (conn, ticket, session, user) =>
        withTenant(conn, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: ticket.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const confirm = (conn, hold, session, user) =>
        withTenant(conn, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            token: hold.token,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const cancel = (conn, hold, session, user) =>
        withTenant(conn, tenantId, (tx) =>
          cancelReservation(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const undo = (conn, checkinId, user, reason) =>
        withTenant(conn, tenantId, (tx) =>
          undoCheckin(tx, { tenantId, eventId, checkinId, actorUserId: user.userId, reason }),
        );
      const revoke = (conn, ticket, user) =>
        withTenant(conn, tenantId, (tx) =>
          revokeTicket(tx, {
            tenantId,
            eventId,
            ticketId: ticket.ticketId,
            actorUserId: user.userId,
            reason: 'race revoke',
          }),
        );
      const snapshot = (ticket) =>
        withTenant(db, tenantId, async (tx) => {
          const state = await tx.$queryRaw`
            SELECT state FROM tickets WHERE id = ${ticket.ticketId}::uuid`;
          const checkins = await tx.$queryRaw`
            SELECT id, undone_at FROM checkins WHERE ticket_id = ${ticket.ticketId}::uuid`;
          const holds = await tx.$queryRaw`
            SELECT id, status, staff_session_id FROM checkin_reservations
            WHERE ticket_id = ${ticket.ticketId}::uuid`;
          return {
            state: state[0].state,
            current: checkins.filter((c) => !c.undone_at).length,
            undone: checkins.filter((c) => c.undone_at).length,
            held: holds.filter((h) => h.status === 'HELD').length,
            holds,
          };
        });
      const audits = (action, resourceId) =>
        withTenant(db, tenantId, async (tx) => {
          const r = await tx.$queryRaw`
            SELECT count(*)::int AS n FROM audit_logs
            WHERE action = ${action} AND resource_id = ${resourceId}::uuid`;
          return r[0].n;
        });

      // ── cancel vs confirm on the same hold ────────────────────────────────────
      const seen = { confirmWon: 0, cancelWon: 0 };
      for (let i = 0; i < ROUNDS; i++) {
        const ticket = await issue();
        const hold = unwrapReserveOutcome(await reserve(db, ticket, sessA, staffA));
        const [confirmed, cancelled] = await Promise.all([
          confirm(db, hold, sessA, staffA),
          cancel(db2, hold, sessA, staffA),
        ]);
        const s = await snapshot(ticket);
        assert.equal(s.held, 0, 'no HELD hold may survive the race');
        assert.ok(s.current <= 1, 'never more than one current check-in');
        if (confirmed.ok) {
          // Confirm won; cancel must see a CONFIRMED reservation, not release it.
          seen.confirmWon++;
          assert.equal(cancelled.ok, false);
          assert.equal(cancelled.code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
          assert.equal(s.state, 'USED');
          assert.equal(s.current, 1);
          assert.deepEqual(s.holds.map((h) => h.status), ['CONFIRMED']);
          assert.equal(await audits('gate.cancel', hold.reservationId), 0);
        } else {
          // Cancel won; the released hold can no longer be confirmed.
          seen.cancelWon++;
          assert.equal(cancelled.ok, true);
          assert.equal(cancelled.replayed, false);
          assert.equal(confirmed.code, GATE_ERROR_CODES.RESERVATION_EXPIRED);
          assert.equal(s.state, 'ACTIVE');
          assert.equal(s.current, 0);
          assert.deepEqual(s.holds.map((h) => h.status), ['RELEASED']);
          assert.equal(await audits('gate.cancel', hold.reservationId), 1);
        }
      }

      // ── cancel vs expiry ───────────────────────────────────────────────────────
      {
        // An expired hold that is still marked HELD can be cancelled without error.
        const ticket = await issue();
        const hold = unwrapReserveOutcome(await reserve(db, ticket, sessA, staffA));
        await withTenant(db, tenantId, (tx) =>
          tx.$executeRaw`
            UPDATE checkin_reservations
            SET expires_at = clock_timestamp() - interval '1 second'
            WHERE id = ${hold.reservationId}::uuid`,
        );
        const released = await cancel(db, hold, sessA, staffA);
        assert.equal(released.ok, true);
        let s = await snapshot(ticket);
        assert.equal(s.current, 0);
        assert.equal(s.held, 0);
        const late = await confirm(db, hold, sessA, staffA);
        assert.equal(late.ok, false);
        assert.equal(late.code, GATE_ERROR_CODES.RESERVATION_EXPIRED);
      }
      for (let i = 0; i < ROUNDS; i++) {
        // Holder cancels while another session takes the expired ticket.
        const ticket = await issue();
        const hold = unwrapReserveOutcome(await reserve(db, ticket, sessA, staffA));
        await withTenant(db, tenantId, (tx) =>
          tx.$executeRaw`
            UPDATE checkin_reservations
            SET expires_at = clock_timestamp() - interval '1 second'
            WHERE id = ${hold.reservationId}::uuid`,
        );
        const [cancelled, taken] = await Promise.all([
          cancel(db, hold, sessA, staffA),
          reserve(db2, ticket, sessB, staffB),
        ]);
        assert.equal(cancelled.ok, true, 'cancel of an expired hold never fails');
        assert.equal(taken.ok, true, 'the other session always gets the ticket');
        const s = await snapshot(ticket);
        assert.equal(s.current, 0);
        assert.equal(s.held, 1, 'exactly one live hold, the new one');
        const live = s.holds.find((h) => h.status === 'HELD');
        assert.equal(live.id, taken.reservationId);
        assert.notEqual(live.id, hold.reservationId);
        assert.equal(s.state, 'ACTIVE');
      }

      // ── undo vs scan (a second session reserving the same ticket) ───────────
      for (let i = 0; i < ROUNDS / 2; i++) {
        const ticket = await issue();
        const hold = unwrapReserveOutcome(await reserve(db, ticket, sessA, staffA));
        const won = unwrapConfirmOutcome(await confirm(db, hold, sessA, staffA));
        const [undone, scan] = await Promise.all([
          undo(db, won.checkinId, staffB, 'race undo'),
          reserve(db2, ticket, sessB, staffB),
        ]);
        assert.equal(undone.state, 'ACTIVE');
        let s = await snapshot(ticket);
        assert.equal(s.current, 0, 'the undone check-in is no longer current');
        assert.equal(s.undone, 1, 'the undone row stays as history');
        assert.equal(s.state, 'ACTIVE');
        assert.equal(await audits('gate.undo', won.checkinId), 1);
        if (scan.ok) {
          // Undo landed first, so the scan got a live hold that can be confirmed.
          assert.equal(s.held, 1);
          unwrapConfirmOutcome(await confirm(db, scan, sessB, staffB));
        } else {
          // Scan landed first and was refused; a fresh scan works after the undo.
          assert.equal(scan.code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
          assert.equal(s.held, 0);
          unwrapReserveOutcome(await reserve(db, ticket, sessB, staffB));
        }
        s = await snapshot(ticket);
        assert.ok(s.current <= 1);
      }

      // ── undo vs revoke ────────────────────────────────────────────────────────
      for (let i = 0; i < ROUNDS / 2; i++) {
        const ticket = await issue();
        const hold = unwrapReserveOutcome(await reserve(db, ticket, sessA, staffA));
        const won = unwrapConfirmOutcome(await confirm(db, hold, sessA, staffA));
        const results = await Promise.allSettled([
          undo(db, won.checkinId, staffB, 'race undo'),
          revoke(db2, ticket, staffB),
        ]);
        for (const r of results) {
          assert.equal(r.status, 'fulfilled', 'neither side may fail under the race');
        }
        const s = await snapshot(ticket);
        // Whatever the order, a revoked ticket must never come back to ACTIVE.
        assert.equal(s.state, 'REVOKED');
        assert.equal(s.current, 0);
        assert.equal(s.undone, 1);
        assert.equal(await audits('gate.undo', won.checkinId), 1);
        assert.equal(await audits('ticket.revoke', ticket.ticketId), 1);
      }

      console.log(
        `cancel-vs-confirm interleavings: confirm won ${seen.confirmWon}, cancel won ${seen.cancelWon}`,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (db2) await db2.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', '-v', name);
        } catch {
          /* best effort cleanup */
        }
      }
    }
  },
);
