// F04 GATE-07 — authz is re-checked on every offline-sync call, including a
// retry of an event that was already applied (PLAN §6.2: "authz được kiểm cả
// khi retry"). A revoked permission or session must not let a DUPLICATE replay
// through, and must not add check-ins or rewrite the ledger.
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
  applyOfflineSyncBatch,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'offline-authz-retry-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const ISSUER = 'http://127.0.0.1:8080/realms/ticket';

async function startIsolatedPostgres() {
  const name = 'ticket-off-authz-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=off_authz_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'off_authz_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/off_authz_test',
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
      "CREATE ROLE off_authz_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO off_authz_login');
    return {
      name,
      url: 'postgresql://off_authz_login:' + password + '@127.0.0.1:' + port + '/off_authz_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

test(
  'GATE-07 authz on retry: revoked permission or session cannot replay a DUPLICATE',
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
      const guest = await mkUser('oa-guest');
      const admin = await mkUser('oa-admin');
      // Two scanners so each revocation path has its own victim.
      const permScanner = await mkUser('oa-perm-scanner');
      const sessScanner = await mkUser('oa-sess-scanner');

      const tenantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const eventId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const assignments = {};
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'off-authz', name: 'Offline authz' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'off-authz-event',
            name: 'Offline authz event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: ['OA-1', 'OA-2'],
        });
        for (const [key, user] of [
          ['admin', admin],
          ['perm', permScanner],
          ['sess', sessScanner],
        ]) {
          const role = key === 'admin' ? 'Supervisor' : 'Scanner';
          const perms =
            key === 'admin'
              ? ['gate.confirm', 'gate.undo']
              : ['gate.confirm'];
          const membership = await grantMembership(tx, {
            tenantId,
            userId: user.userId,
            role,
            permissions: perms,
          });
          const assignment = await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions: perms,
          });
          assignments[key] = { membership, assignment };
        }
      });

      const tickets = [];
      for (const code of ['OA-1', 'OA-2']) {
        tickets.push(
          unwrapRedeemOutcome(
            await withTenant(db, tenantId, (tx) =>
              redeemAndIssueTicket(tx, HMAC, 'offline-authz-cred-key', {
                tenantId,
                eventId,
                actorUserId: guest.userId,
                actorEmail: guest.email,
                emailVerified: true,
                rawCode: code,
                idempotencyKey: randomUUID(),
              }),
            ),
          ),
        );
      }

      const open = (user) =>
        withTenant(db, tenantId, (tx) =>
          openStaffSession(tx, { tenantId, eventId, userId: user.userId }),
        );
      const sessPerm = await open(permScanner);
      const sessSess = await open(sessScanner);

      const now = Date.now();
      const deviceId = randomUUID();
      const batch = (user, session, ticket, clientEventId) =>
        withTenant(db, tenantId, (tx) =>
          applyOfflineSyncBatch(tx, {
            pathEventId: eventId,
            actorUserId: user.userId,
            serverEpochMs: now,
            body: {
              tenantId,
              staffSessionId: session.sessionId,
              deviceId,
              clientClockAt: new Date(now).toISOString(),
              events: [
                {
                  clientEventId,
                  type: 'CHECKIN_OFFLINE',
                  eventId,
                  ticketId: ticket.ticketId,
                  clientOccurredAt: new Date(now - 5000).toISOString(),
                  clientSeq: 0,
                  payloadVersion: 1,
                },
              ],
            },
          }),
        );
      const ledger = () =>
        withTenant(db, tenantId, async (tx) => {
          const checkins = await tx.$queryRaw`
            SELECT count(*)::int AS n FROM checkins WHERE undone_at IS NULL`;
          const events = await tx.$queryRaw`
            SELECT count(*)::int AS n FROM offline_sync_events`;
          return { checkins: checkins[0].n, events: events[0].n };
        });

      // ── permission revoked, then the same event is retried ──────────────────
      const eventPerm = randomUUID();
      const appliedPerm = await batch(permScanner, sessPerm, tickets[0], eventPerm);
      assert.equal(appliedPerm.results[0].status, 'APPLIED');
      assert.equal(
        (await batch(permScanner, sessPerm, tickets[0], eventPerm)).results[0].status,
        'DUPLICATE',
        'before revocation the retry is a harmless DUPLICATE',
      );
      const before = await ledger();
      await withTenant(db, tenantId, (tx) =>
        tx.$executeRaw`
          UPDATE event_assignments SET revoked_at = clock_timestamp()
          WHERE tenant_id = ${tenantId}::uuid
            AND membership_id = ${assignments.perm.membership.membershipId}::uuid`,
      );
      await assert.rejects(
        () => batch(permScanner, sessPerm, tickets[0], eventPerm),
        AuthzError,
        'a revoked assignment must not replay a DUPLICATE',
      );
      assert.deepEqual(await ledger(), before, 'denied retry must not mutate');

      // ── session revoked, then the same event is retried ─────────────────────
      const eventSess = randomUUID();
      assert.equal(
        (await batch(sessScanner, sessSess, tickets[1], eventSess)).results[0].status,
        'APPLIED',
      );
      const beforeSess = await ledger();
      await withTenant(db, tenantId, (tx) =>
        revokeStaffSession(tx, {
          tenantId,
          eventId,
          sessionId: sessSess.sessionId,
          actorUserId: admin.userId,
        }),
      );
      await assert.rejects(
        () => batch(sessScanner, sessSess, tickets[1], eventSess),
        (error) =>
          error instanceof GateError &&
          error.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
        'a revoked session must not replay a DUPLICATE',
      );
      assert.deepEqual(await ledger(), beforeSess, 'denied retry must not mutate');
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

test(
  'GATE-07 two sessions replay one ticket: exactly one current check-in',
  { timeout: 240000 },
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
      const guest = await mkUser('ts-guest');
      const scannerA = await mkUser('ts-scanner-a');
      const scannerB = await mkUser('ts-scanner-b');

      const tenantId = 'dddddddd-1111-4ddd-8ddd-dddddddddddd';
      const eventId = 'ffffffff-3333-4fff-8fff-ffffffffffff';
      const ROUNDS = 4;
      const codes = Array.from({ length: ROUNDS }, (_, i) => `TS-${i}`);
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'off-two', name: 'Offline two sessions' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'off-two-event',
            name: 'Offline two sessions event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: codes,
        });
        for (const user of [scannerA, scannerB]) {
          const membership = await grantMembership(tx, {
            tenantId,
            userId: user.userId,
            role: 'Scanner',
            permissions: ['gate.confirm'],
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions: ['gate.confirm'],
          });
        }
      });

      const open = (user) =>
        withTenant(db, tenantId, (tx) =>
          openStaffSession(tx, { tenantId, eventId, userId: user.userId }),
        );
      const sessA = await open(scannerA);
      const sessB = await open(scannerB);
      const deviceA = randomUUID();
      const deviceB = randomUUID();
      const now = Date.now();

      const issue = async (code) =>
        unwrapRedeemOutcome(
          await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, 'offline-two-cred-key', {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: code,
              idempotencyKey: randomUUID(),
            }),
          ),
        );
      const batch = (conn, user, session, deviceId, ticket, clientEventId) =>
        withTenant(conn, tenantId, (tx) =>
          applyOfflineSyncBatch(tx, {
            pathEventId: eventId,
            actorUserId: user.userId,
            serverEpochMs: now,
            body: {
              tenantId,
              staffSessionId: session.sessionId,
              deviceId,
              clientClockAt: new Date(now).toISOString(),
              events: [
                {
                  clientEventId,
                  type: 'CHECKIN_OFFLINE',
                  eventId,
                  ticketId: ticket.ticketId,
                  clientOccurredAt: new Date(now - 5000).toISOString(),
                  clientSeq: 0,
                  payloadVersion: 1,
                },
              ],
            },
          }),
        );
      const currentCheckins = (ticket) =>
        withTenant(db, tenantId, async (tx) => {
          const r = await tx.$queryRaw`
            SELECT id FROM checkins
            WHERE ticket_id = ${ticket.ticketId}::uuid AND undone_at IS NULL`;
          return r.map((row) => row.id);
        });

      const wins = { a: 0, b: 0 };
      for (let i = 0; i < ROUNDS; i++) {
        const ticket = await issue(codes[i]);
        const eventA = randomUUID();
        const eventB = randomUUID();
        // Two devices, two sessions, two users replay the SAME ticket at once.
        const [ra, rb] = await Promise.all([
          batch(db, scannerA, sessA, deviceA, ticket, eventA),
          batch(db2, scannerB, sessB, deviceB, ticket, eventB),
        ]);
        const a = ra.results[0];
        const b = rb.results[0];
        const statuses = [a.status, b.status].sort();
        assert.deepEqual(
          statuses,
          ['APPLIED', 'CONFLICT'],
          'exactly one session wins the ticket',
        );
        const winner = a.status === 'APPLIED' ? a : b;
        const loser = a.status === 'APPLIED' ? b : a;
        wins[a.status === 'APPLIED' ? 'a' : 'b']++;
        // Both sides replayed offline, so the loser lost a replay race
        // (OFFLINE_SYNC_CONFLICT_LOST); ALREADY_CHECKED_IN is the code when the
        // winner was an online confirm (see offline-sync-apply.test.cjs).
        assert.equal(loser.code, GATE_ERROR_CODES.OFFLINE_SYNC_CONFLICT_LOST);
        assert.equal(
          loser.winningCheckinId,
          winner.checkinId,
          'the loser is told which check-in won',
        );
        const current = await currentCheckins(ticket);
        assert.deepEqual(current, [winner.checkinId], 'one current check-in, the winner');

        // Replaying either batch again changes nothing.
        const [ra2, rb2] = await Promise.all([
          batch(db, scannerA, sessA, deviceA, ticket, eventA),
          batch(db2, scannerB, sessB, deviceB, ticket, eventB),
        ]);
        assert.deepEqual(
          [ra2.results[0].status, rb2.results[0].status].sort(),
          ['CONFLICT', 'DUPLICATE'],
          'the winner replays as DUPLICATE, the loser stays CONFLICT',
        );
        assert.deepEqual(await currentCheckins(ticket), [winner.checkinId]);
      }
      console.log(`two-session winners: A ${wins.a}, B ${wins.b}`);
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
