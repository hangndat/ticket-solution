const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
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
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  undoCheckin,
  revokeTicket,
  reissueTicketCredential,
  revokeStaffSession,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

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
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
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
      const cs = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'cs', email: 'cs@example.com', emailVerified: true,
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
          rawCodes: ['GATE-CODE', 'GATE-REVOKE', 'GATE-REISSUE-RACE'],
        });
        for (const userId of [staff.userId, staffB.userId]) {
          const membership = await grantMembership(tx, {
            tenantId,
            userId,
            role: 'Supervisor',
            permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke', 'ticket.reissue'],
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke', 'ticket.reissue'],
          });
        }
        const csMembership = await grantMembership(tx, {
          tenantId, userId: cs.userId, role: 'CS',
          permissions: ['cs.lookup', 'cs.resend'],
        });
        await grantEventAssignment(tx, {
          tenantId, eventId, membershipId: csMembership.membershipId,
          permissions: ['cs.lookup', 'cs.resend'],
        });
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
      let hold = unwrapReserveOutcome(
        await withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: issued.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      );
      const originalHold = hold;
      hold = unwrapReserveOutcome(await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId, eventId, ticketId: issued.ticketId,
          staffSessionId: session.sessionId, actorUserId: staff.userId,
        }),
      ));
      assert.equal(hold.reservationId, originalHold.reservationId);
      assert.notEqual(hold.token, originalHold.token);
      const staleToken = await withTenant(db, tenantId, (tx) =>
        confirmCheckin(tx, {
          tenantId, eventId, reservationId: hold.reservationId,
          token: originalHold.token, staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(staleToken.ok, false);
      assert.equal(staleToken.code, GATE_ERROR_CODES.RESERVATION_TOKEN_MISMATCH);
      const beforeConfirm = await withTenant(db, tenantId, async (tx) => {
        const reservations = await tx.$queryRaw`SELECT status FROM checkin_reservations WHERE ticket_id = ${issued.ticketId}::uuid`;
        const checkins = await tx.$queryRaw`SELECT count(*)::int AS n FROM checkins WHERE ticket_id = ${issued.ticketId}::uuid`;
        return { reservations, checkins };
      });
      assert.deepEqual(beforeConfirm.reservations, [{ status: 'HELD' }]);
      assert.equal(beforeConfirm.checkins[0].n, 0);
      const reissueKey = randomUUID();
      const reissueInput = {
        tenantId, eventId, ticketId: issued.ticketId,
        actorUserId: staff.userId, reason: 'replace damaged QR',
        idempotencyKey: reissueKey,
      };
      const rotated = await withTenant(db, tenantId, (tx) =>
        reissueTicketCredential(tx, 'd3-cred-key', reissueInput),
      );
      assert.deepEqual(rotated, {
        ok: true, ticketId: issued.ticketId, credentialVersion: 2, replayed: false,
      });
      assert.deepEqual(Object.keys(rotated).sort(),
        ['credentialVersion', 'ok', 'replayed', 'ticketId']);
      await assert.rejects(
        () => withTenant(db, tenantId, (tx) =>
          reissueTicketCredential(tx, 'd3-cred-key', {
            ...reissueInput, actorUserId: cs.userId, idempotencyKey: randomUUID(),
          }),
        ),
        (error) => error.code === 'PERMISSION_DENIED',
      );
      for (const role of ['Manager', 'CS', 'Scanner', randomUUID()]) {
        const actor = await users.upsertFromVerifiedIdentity({
          issuer: 'http://127.0.0.1:8080/realms/ticket',
          subject: `reissue-forbidden-${role}`,
          email: `forbidden-${randomUUID()}@example.com`,
          emailVerified: true,
        });
        await withTenant(db, tenantId, async (tx) => {
          const membership = await grantMembership(tx, {
            tenantId, userId: actor.userId, role,
            permissions: ['ticket.reissue'],
          });
          await grantEventAssignment(tx, {
            tenantId, eventId, membershipId: membership.membershipId,
            permissions: ['ticket.reissue'],
          });
        });
        await assert.rejects(
          () => withTenant(db, tenantId, (tx) =>
            reissueTicketCredential(tx, 'd3-cred-key', {
              ...reissueInput, actorUserId: actor.userId,
              idempotencyKey: randomUUID(),
            }),
          ),
          (error) => error.code === 'PERMISSION_DENIED', role,
        );
      }
      const replay = await withTenant(db2, tenantId, (tx) =>
        reissueTicketCredential(tx, 'd3-cred-key', reissueInput),
      );
      assert.deepEqual(replay, { ...rotated, replayed: true });
      await assert.rejects(
        () => withTenant(db, tenantId, (tx) =>
          reissueTicketCredential(tx, 'd3-cred-key', {
            ...reissueInput, reason: 'different reason',
          }),
        ),
        (error) => error.code === 'IDEMPOTENCY_CONFLICT',
      );
      const rotatedRows = await withTenant(db, tenantId, async (tx) => {
        const ticket = await tx.$queryRaw`
          SELECT credential_version FROM tickets WHERE id = ${issued.ticketId}::uuid
        `;
        const credentials = await tx.$queryRaw`
          SELECT version, status FROM ticket_credentials
          WHERE ticket_id = ${issued.ticketId}::uuid ORDER BY version
        `;
        const reservations = await tx.$queryRaw`
          SELECT status FROM checkin_reservations WHERE id = ${hold.reservationId}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT count(*)::int AS n FROM outbox
          WHERE aggregate_id = ${issued.ticketId}::uuid AND type = 'TicketIssued'
        `;
        const audit = await tx.$queryRaw`
          SELECT sanitized_diff FROM audit_logs
          WHERE resource_id = ${issued.ticketId}::uuid
            AND action = 'ticket.credential_reissue'
        `;
        return { ticket, credentials, reservations, outbox, audit };
      });
      assert.equal(rotatedRows.ticket[0].credential_version, 2);
      assert.deepEqual(rotatedRows.credentials, [
        { version: 1, status: 'REVOKED' },
        { version: 2, status: 'ACTIVE' },
      ]);
      assert.equal(rotatedRows.reservations[0].status, 'HELD');
      assert.equal(rotatedRows.outbox[0].n, 2);
      assert.deepEqual(rotatedRows.audit[0].sanitized_diff, { fromVersion: 1, toVersion: 2 });
      await assert.rejects(
        () => withTenant(db, tenantId, (tx) => tx.$executeRaw`
          INSERT INTO ticket_credentials
            (tenant_id, ticket_id, version, kid, token_hash, encrypted_token, status)
          VALUES (${tenantId}::uuid, ${issued.ticketId}::uuid, 3,
            'test', 'test', 'test', 'ACTIVE')
        `),
        (error) => String(error.message).includes('ticket_credentials_one_active_idx'),
      );
      const heldByOther = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: issued.ticketId,
          staffSessionId: other.sessionId,
          actorUserId: staffB.userId,
        }),
      );
      assert.equal(heldByOther.ok, false);
      assert.equal(heldByOther.code, GATE_ERROR_CODES.HELD_BY_OTHER_SESSION);

      const raced = await Promise.all([
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
      const wins = raced.filter((r) => r.ok === true);
      const losses = raced.filter((r) => r.ok === false);
      assert.equal(wins.length, 1);
      assert.equal(losses.length, 1);
      assert.equal(losses[0].code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
      const counts = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM checkins WHERE undone_at IS NULL`,
      );
      assert.equal(counts[0].n, 1);

      const undone = await withTenant(db, tenantId, (tx) =>
        undoCheckin(tx, {
          tenantId,
          eventId,
          checkinId: wins[0].checkinId,
          actorUserId: staff.userId,
          reason: 'khách vào nhầm cổng',
        }),
      );
      assert.equal(undone.state, 'ACTIVE');

      const again = unwrapReserveOutcome(
        await withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: issued.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      );
      await withTenant(db, tenantId, (tx) =>
        tx.$executeRaw`UPDATE checkin_reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = ${again.reservationId}::uuid`,
      );
      const expired = await withTenant(db, tenantId, (tx) =>
        confirmCheckin(tx, {
          tenantId,
          eventId,
          reservationId: again.reservationId,
          token: again.token,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(expired.ok, false);
      assert.equal(expired.code, GATE_ERROR_CODES.RESERVATION_EXPIRED);

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
      const hold2 = unwrapReserveOutcome(
        await withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: second.ticketId,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
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
        const confirmOutcome = raceRevoke[0];
        assert.equal(confirmOutcome.status, 'fulfilled');
        assert.equal(confirmOutcome.value.ok, true);
      } else {
        assert.ok(after.checkins === 0 || after.checkins === 1);
      }
      assert.ok(after.audit >= 2);

      for (const state of ['USED', 'REVOKED', 'CANCELLED']) {
        await withTenant(db, tenantId, (tx) => tx.$executeRaw`
          UPDATE tickets SET state = ${state}
          WHERE tenant_id = ${tenantId}::uuid AND id = ${second.ticketId}::uuid
        `);
        const denied = await withTenant(db, tenantId, (tx) =>
          reissueTicketCredential(tx, 'd3-cred-key', {
            tenantId, eventId, ticketId: second.ticketId,
            actorUserId: staff.userId, reason: 'must deny non-active ticket',
            idempotencyKey: randomUUID(),
          }),
        );
        assert.equal(denied.ok, false, state);
        assert.equal(denied.code, GATE_ERROR_CODES.TICKET_NOT_ACTIVE, state);
      }

      const third = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd3-cred-key', {
            tenantId, eventId, actorUserId: guest.userId,
            actorEmail: guest.email, emailVerified: true,
            rawCode: 'GATE-REISSUE-RACE', idempotencyKey: randomUUID(),
          }),
        ),
      );
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET business_status = 'CANCELLED',
          cancelled_at = clock_timestamp(), cancel_reason = 'fixture cancellation'
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);
      const cancelledEventRotate = await withTenant(db, tenantId, (tx) =>
        reissueTicketCredential(tx, 'd3-cred-key', {
          tenantId, eventId, ticketId: third.ticketId,
          actorUserId: staff.userId, reason: 'event cancelled but ticket active',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(cancelledEventRotate.ok, true);
      assert.equal(cancelledEventRotate.credentialVersion, 2);
      const race = await Promise.allSettled([
        withTenant(db, tenantId, (tx) =>
          reissueTicketCredential(tx, 'd3-cred-key', {
            tenantId, eventId, ticketId: third.ticketId,
            actorUserId: staff.userId, reason: 'race with revoke',
            idempotencyKey: randomUUID(),
          }),
        ),
        withTenant(db2, tenantId, (tx) =>
          revokeTicket(tx, {
            tenantId, eventId, ticketId: third.ticketId,
            actorUserId: staffB.userId, reason: 'race with reissue',
          }),
        ),
      ]);
      assert.equal(race[0].status, 'fulfilled');
      assert.equal(race[1].status, 'fulfilled');
      const racedFinal = await withTenant(db, tenantId, async (tx) => ({
        ticket: await tx.$queryRaw`SELECT state, credential_version FROM tickets
          WHERE id = ${third.ticketId}::uuid`,
        credentials: await tx.$queryRaw`SELECT version, status FROM ticket_credentials
          WHERE ticket_id = ${third.ticketId}::uuid ORDER BY version`,
      }));
      assert.equal(racedFinal.ticket[0].state, 'REVOKED');
      assert.ok(racedFinal.credentials.every((row) => row.status === 'REVOKED'));
      assert.equal(racedFinal.ticket[0].credential_version,
        race[0].value.ok ? 3 : 2);
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET business_status = 'ACTIVE',
          cancelled_at = NULL, cancel_reason = NULL
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);

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
