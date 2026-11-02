// F04 GATE-02 / GATE-04 / GATE-05 — D acceptance on a fresh PostgreSQL.
// Complements gate.test.cjs, which holds the race/expiry/revoke path.
// Each section maps to one clause of the PLAN §6.2 AC; see ACCEPTANCE.md.
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
  GateError,
  AuthzError,
  GATE_ERROR_CODES,
  openStaffSession,
  revokeStaffSession,
  reserveCheckin,
  confirmCheckin,
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  undoCheckin,
  cancelReservation,
  unwrapCancelOutcome,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'gate-acceptance-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const ISSUER = 'http://127.0.0.1:8080/realms/ticket';

async function startIsolatedPostgres() {
  const name = 'ticket-gate-acc-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=gate_acc_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'gate_acc_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/gate_acc_test',
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
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE gate_acc_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO gate_acc_login');
    return {
      name,
      url: 'postgresql://gate_acc_login:' + password + '@127.0.0.1:' + port + '/gate_acc_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

const TICKET_CODES = ['GA-T1', 'GA-T2', 'GA-T3', 'GA-T4', 'GA-T5', 'GA-T6', 'GA-T7'];

test(
  'GATE-02/04/05 acceptance: hold, confirm and undo contracts',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const mkUser = (subject) =>
        users.upsertFromVerifiedIdentity({
          issuer: ISSUER,
          subject,
          email: `${subject}@example.com`,
          emailVerified: true,
        });
      const staffA = await mkUser('acc-staff-a');
      const staffB = await mkUser('acc-staff-b');
      const scanner = await mkUser('acc-scanner');
      const guests = [];
      for (let i = 0; i < TICKET_CODES.length; i++)
        guests.push(await mkUser(`acc-guest-${i}`));

      const tenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'gate-acc', name: 'Gate acceptance' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'gate-acc-event',
            name: 'Gate acceptance event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: TICKET_CODES,
        });
        const grant = async (user, role, permissions) => {
          const membership = await grantMembership(tx, {
            tenantId,
            userId: user.userId,
            role,
            permissions,
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions,
          });
        };
        await grant(staffA, 'Supervisor', ['gate.confirm', 'gate.undo']);
        await grant(staffB, 'Supervisor', ['gate.confirm', 'gate.undo']);
        // Scanner: may reserve/confirm, must not hold gate.undo.
        await grant(scanner, 'Scanner', ['gate.confirm']);
      });

      const issue = async (index) =>
        unwrapRedeemOutcome(
          await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, 'gate-acc-cred-key', {
              tenantId,
              eventId,
              actorUserId: guests[index].userId,
              actorEmail: guests[index].email,
              emailVerified: true,
              rawCode: TICKET_CODES[index],
              idempotencyKey: randomUUID(),
            }),
          ),
        );
      const tickets = [];
      for (let i = 0; i < TICKET_CODES.length; i++) tickets.push(await issue(i));

      const open = (user) =>
        withTenant(db, tenantId, (tx) =>
          openStaffSession(tx, { tenantId, eventId, userId: user.userId }),
        );
      const sessA = await open(staffA);
      const sessB = await open(staffB);
      const sessScanner = await open(scanner);

      const reserve = (ticket, session, user) =>
        withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: ticket.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const confirm = (hold, token, session, user) =>
        withTenant(db, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            token,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const cancel = (hold, session, user) =>
        withTenant(db, tenantId, (tx) =>
          cancelReservation(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            staffSessionId: session.sessionId,
            actorUserId: user.userId,
          }),
        );
      const undo = (checkinId, user, reason) =>
        withTenant(db, tenantId, (tx) =>
          undoCheckin(tx, {
            tenantId,
            eventId,
            checkinId,
            actorUserId: user.userId,
            reason,
          }),
        );
      const rows = (ticket) =>
        withTenant(db, tenantId, async (tx) => {
          const ticketRow = await tx.$queryRaw`
            SELECT state FROM tickets WHERE id = ${ticket.ticketId}::uuid`;
          const checkins = await tx.$queryRaw`
            SELECT id, undone_at, undo_reason, undone_by
            FROM checkins WHERE ticket_id = ${ticket.ticketId}::uuid
            ORDER BY confirmed_at`;
          const reservations = await tx.$queryRaw`
            SELECT id, status FROM checkin_reservations
            WHERE ticket_id = ${ticket.ticketId}::uuid ORDER BY created_at`;
          return {
            state: ticketRow[0].state,
            checkins,
            reservations,
            current: checkins.filter((c) => !c.undone_at).length,
          };
        });
      const auditCount = (action, resourceId) =>
        withTenant(db, tenantId, async (tx) => {
          const r = await tx.$queryRaw`
            SELECT count(*)::int AS n FROM audit_logs
            WHERE action = ${action} AND resource_id = ${resourceId}::uuid`;
          return r[0].n;
        });

      // ── GATE-02: a hold is not a check-in; the same holder can retry ─────────
      {
        const t = tickets[0];
        const first = unwrapReserveOutcome(await reserve(t, sessA, staffA));
        let r = await rows(t);
        assert.equal(r.checkins.length, 0, 'reserve must not create a check-in');
        assert.equal(r.state, 'ACTIVE', 'reserve must not consume the ticket');
        assert.deepEqual(r.reservations.map((x) => x.status), ['HELD']);

        const retry = unwrapReserveOutcome(await reserve(t, sessA, staffA));
        assert.equal(
          retry.reservationId,
          first.reservationId,
          'same holder retry reuses the hold',
        );
        assert.notEqual(retry.token, first.token, 'retry rotates the token');
        r = await rows(t);
        assert.equal(r.reservations.length, 1, 'retry must not open a second hold');
        assert.equal(r.checkins.length, 0);

        const stale = await confirm(first, first.token, sessA, staffA);
        assert.equal(stale.ok, false);
        assert.equal(stale.code, GATE_ERROR_CODES.RESERVATION_TOKEN_MISMATCH);
        r = await rows(t);
        assert.equal(r.checkins.length, 0, 'stale token must not check in');
        assert.deepEqual(r.reservations.map((x) => x.status), ['HELD']);
      }

      // ── GATE-02: an expired hold is released to another session ─────────────
      {
        const t = tickets[1];
        const held = unwrapReserveOutcome(await reserve(t, sessA, staffA));
        const blocked = await reserve(t, sessB, staffB);
        assert.equal(blocked.ok, false);
        assert.equal(blocked.code, GATE_ERROR_CODES.HELD_BY_OTHER_SESSION);
        await withTenant(db, tenantId, (tx) =>
          tx.$executeRaw`
            UPDATE checkin_reservations
            SET expires_at = clock_timestamp() - interval '1 second'
            WHERE id = ${held.reservationId}::uuid`,
        );
        const taken = unwrapReserveOutcome(await reserve(t, sessB, staffB));
        assert.notEqual(taken.reservationId, held.reservationId);
        const late = await confirm(held, held.token, sessA, staffA);
        assert.equal(late.ok, false, 'the expired holder must not confirm');
        const r = await rows(t);
        assert.equal(r.checkins.length, 0, 'expiry must not create a check-in');
        assert.equal(r.state, 'ACTIVE');
      }

      // ── GATE-04: wrong holder / wrong token never mutate ─────────────────────
      {
        const t = tickets[2];
        const hold = unwrapReserveOutcome(await reserve(t, sessA, staffA));
        const wrongHolder = await confirm(hold, hold.token, sessB, staffB);
        assert.equal(wrongHolder.ok, false);
        assert.equal(wrongHolder.code, GATE_ERROR_CODES.HELD_BY_OTHER_SESSION);
        const wrongToken = await confirm(
          hold,
          'x'.repeat(hold.token.length),
          sessA,
          staffA,
        );
        assert.equal(wrongToken.ok, false);
        assert.equal(wrongToken.code, GATE_ERROR_CODES.RESERVATION_TOKEN_MISMATCH);
        let r = await rows(t);
        assert.equal(r.checkins.length, 0, 'denied confirms must not check in');
        assert.deepEqual(r.reservations.map((x) => x.status), ['HELD']);
        assert.equal(r.state, 'ACTIVE');

        const won = unwrapConfirmOutcome(await confirm(hold, hold.token, sessA, staffA));
        assert.equal(won.state, 'USED');
        // Lost response: the client retries the same confirm. It must not add a
        // second check-in.
        const retried = await confirm(hold, hold.token, sessA, staffA);
        assert.equal(retried.ok, false);
        assert.equal(retried.code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
        r = await rows(t);
        assert.equal(r.checkins.length, 1, 'retry must not add a check-in');
        assert.equal(r.current, 1);
      }

      // ── GATE-04: confirm after the staff session is revoked ──────────────────
      {
        const t = tickets[3];
        const hold = unwrapReserveOutcome(await reserve(t, sessA, staffA));
        await withTenant(db, tenantId, (tx) =>
          revokeStaffSession(tx, {
            tenantId,
            eventId,
            sessionId: sessA.sessionId,
            actorUserId: staffB.userId,
          }),
        );
        await assert.rejects(
          () => confirm(hold, hold.token, sessA, staffA),
          (error) =>
            error instanceof GateError &&
            error.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
        );
        const r = await rows(t);
        assert.equal(r.checkins.length, 0, 'revoked session must not check in');
        assert.equal(r.state, 'ACTIVE');
      }

      // ── GATE-05: undo needs permission and a reason, and keeps history ───────
      {
        const t = tickets[4];
        const hold = unwrapReserveOutcome(await reserve(t, sessScanner, scanner));
        const done = unwrapConfirmOutcome(
          await confirm(hold, hold.token, sessScanner, scanner),
        );
        assert.equal(done.state, 'USED', 'a Scanner may confirm');

        // A Scanner holds gate.confirm but not gate.undo, so it cannot override.
        await assert.rejects(
          () => undo(done.checkinId, scanner, 'scanner override attempt'),
          AuthzError,
        );
        let r = await rows(t);
        assert.equal(r.current, 1, 'denied undo must keep the check-in');
        assert.equal(r.state, 'USED');

        // A blank reason is refused with REASON_REQUIRED and no mutation.
        await assert.rejects(
          () => undo(done.checkinId, staffB, '   '),
          (error) =>
            error instanceof GateError &&
            error.code === GATE_ERROR_CODES.REASON_REQUIRED,
        );
        r = await rows(t);
        assert.equal(r.current, 1, 'blank-reason undo must keep the check-in');
        assert.equal(await auditCount('gate.undo', done.checkinId), 0);

        const undone = await undo(done.checkinId, staffB, 'khách vào nhầm cổng');
        assert.equal(undone.state, 'ACTIVE');
        r = await rows(t);
        assert.equal(r.state, 'ACTIVE');
        assert.equal(r.current, 0);
        // History is retained: the row stays, marked undone with who and why.
        assert.equal(r.checkins.length, 1, 'undo must not delete the check-in row');
        assert.ok(r.checkins[0].undone_at);
        assert.equal(r.checkins[0].undo_reason, 'khách vào nhầm cổng');
        assert.equal(r.checkins[0].undone_by, staffB.userId);
        assert.equal(await auditCount('gate.undo', done.checkinId), 1);

        assert.equal(undone.replayed, false);
        // Replay: the client lost the response and retries the same undo. It gets
        // the original result back, with no second audit row and no state change.
        const replay = await undo(done.checkinId, staffB, 'khách vào nhầm cổng');
        assert.equal(replay.replayed, true);
        assert.equal(replay.checkinId, done.checkinId);
        assert.equal(replay.state, 'ACTIVE');
        assert.equal(await auditCount('gate.undo', done.checkinId), 1);
        r = await rows(t);
        assert.equal(r.current, 0, 'replay must not change the ticket');
        // A different reason is a different request, so it stays a conflict.
        await assert.rejects(
          () => undo(done.checkinId, staffB, 'undo again'),
          (error) =>
            error instanceof GateError &&
            error.code === GATE_ERROR_CODES.CHECKIN_ALREADY_UNDONE,
        );
        assert.equal(await auditCount('gate.undo', done.checkinId), 1);
        await assert.rejects(
          () => undo(randomUUID(), staffB, 'unknown check-in'),
          (error) =>
            error instanceof GateError &&
            error.code === GATE_ERROR_CODES.CHECKIN_NOT_FOUND,
        );

        // O05: after an undo the ticket can be admitted again, still exactly one
        // current check-in, and the undone row remains as history.
        const again = unwrapReserveOutcome(await reserve(t, sessB, staffB));
        unwrapConfirmOutcome(await confirm(again, again.token, sessB, staffB));
        r = await rows(t);
        assert.equal(r.current, 1);
        assert.equal(r.checkins.length, 2, 're-entry keeps the undone row as history');
      }

      // ── GATE-02: a hold can be released on purpose ───────────────────────────
      {
        const t = tickets[5];
        const hold = unwrapReserveOutcome(await reserve(t, sessB, staffB));
        // Only the holding session may release it.
        const foreign = await cancel(hold, sessScanner, scanner);
        assert.equal(foreign.ok, false);
        assert.equal(foreign.code, GATE_ERROR_CODES.HELD_BY_OTHER_SESSION);
        let r = await rows(t);
        assert.deepEqual(r.reservations.map((x) => x.status), ['HELD']);

        const released = unwrapCancelOutcome(await cancel(hold, sessB, staffB));
        assert.equal(released.status, 'RELEASED');
        assert.equal(released.replayed, false);
        r = await rows(t);
        assert.deepEqual(r.reservations.map((x) => x.status), ['RELEASED']);
        assert.equal(r.checkins.length, 0, 'cancel must not create a check-in');
        assert.equal(r.state, 'ACTIVE');
        assert.equal(await auditCount('gate.cancel', hold.reservationId), 1);

        // The released hold cannot be confirmed any more.
        const late = await confirm(hold, hold.token, sessB, staffB);
        assert.equal(late.ok, false);
        assert.equal(late.code, GATE_ERROR_CODES.RESERVATION_EXPIRED);

        // Another session can take the ticket straight away.
        const taken = unwrapReserveOutcome(await reserve(t, sessScanner, scanner));
        assert.notEqual(taken.reservationId, hold.reservationId);

        // Replay: cancelling the same hold again is harmless, adds no audit row and
        // leaves the new holder's hold untouched.
        const again = unwrapCancelOutcome(await cancel(hold, sessB, staffB));
        assert.equal(again.replayed, true);
        assert.equal(await auditCount('gate.cancel', hold.reservationId), 1);
        r = await rows(t);
        assert.deepEqual(
          r.reservations.map((x) => x.status).sort(),
          ['HELD', 'RELEASED'],
        );

        const unknown = await cancel(
          { reservationId: randomUUID() },
          sessB,
          staffB,
        );
        assert.equal(unknown.ok, false);
        assert.equal(unknown.code, GATE_ERROR_CODES.RESERVATION_NOT_FOUND);
      }
      {
        // A confirmed reservation is a check-in, not a hold: it cannot be released.
        const t = tickets[6];
        const hold = unwrapReserveOutcome(await reserve(t, sessB, staffB));
        unwrapConfirmOutcome(await confirm(hold, hold.token, sessB, staffB));
        const denied = await cancel(hold, sessB, staffB);
        assert.equal(denied.ok, false);
        assert.equal(denied.code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
        const r = await rows(t);
        assert.equal(r.current, 1);
        assert.deepEqual(r.reservations.map((x) => x.status), ['CONFIRMED']);
      }
    } finally {
      if (db) await db.$disconnect().catch(() => {});
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
