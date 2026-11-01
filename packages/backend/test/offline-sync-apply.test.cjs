'use strict';

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
  openStaffSession,
  confirmCheckin,
  reserveCheckin,
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  applyOfflineSyncBatch,
  validateOfflineSyncRequest,
  GATE_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd7-offline-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'd7-offline-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-d7-offline-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d7_offline_test',
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
        'd7_offline_test',
      );
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d7_offline_test',
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
    for (const file of MIGRATIONS) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d7_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d7_login');
    return {
      name,
      url:
        'postgresql://d7_login:' +
        password +
        '@127.0.0.1:' +
        port +
        '/d7_offline_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

function stopContainer(name) {
  try {
    docker('rm', '-f', name);
  } catch {
    /* ignore */
  }
}

test(
  'offline sync: apply, idempotent duplicate, conflict lost, no double-admit',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-offline',
        email: 'staff-offline@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'guest-offline',
        email: 'guest-offline@example.com',
        emailVerified: true,
      });
      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const deviceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'offline-tenant', name: 'Offline' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'offline-event',
            name: 'Offline Event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['OFF-A', 'OFF-B', 'OFF-C', 'OFF-D', 'OFF-E'],
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'STAFF',
          permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
        });
      });

      const ticketIds = [];
      for (const code of ['OFF-A', 'OFF-B', 'OFF-C', 'OFF-D', 'OFF-E']) {
        const issued = unwrapRedeemOutcome(
          await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
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
        ticketIds.push(issued.ticketId);
      }

      const session = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staff.userId,
        }),
      );

      const now = Date.now();
      const clientClockAt = new Date(now).toISOString();
      const occurred = new Date(now - 5_000).toISOString();
      const clientEventA = randomUUID();
      const clientEventB = randomUUID();
      const clientEventC = randomUUID();

      const first = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: {
            tenantId,
            staffSessionId: session.sessionId,
            deviceId,
            clientClockAt,
            events: [
              {
                clientEventId: clientEventA,
                type: 'CHECKIN_OFFLINE',
                eventId,
                ticketId: ticketIds[0],
                clientOccurredAt: occurred,
                clientSeq: 0,
                payloadVersion: 1,
              },
              {
                clientEventId: clientEventB,
                type: 'CHECKIN_OFFLINE',
                eventId,
                ticketId: ticketIds[1],
                clientOccurredAt: occurred,
                clientSeq: 1,
                payloadVersion: 1,
              },
            ],
          },
        }),
      );

      assert.equal(first.results.length, 2);
      assert.equal(first.results[0].status, 'APPLIED');
      assert.equal(first.results[1].status, 'APPLIED');
      assert.ok(first.results[0].checkinId);
      assert.ok(first.results[1].checkinId);

      const dup = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: {
            tenantId,
            staffSessionId: session.sessionId,
            deviceId,
            clientClockAt,
            events: [
              {
                clientEventId: clientEventA,
                type: 'CHECKIN_OFFLINE',
                eventId,
                ticketId: ticketIds[0],
                clientOccurredAt: occurred,
                clientSeq: 0,
                payloadVersion: 1,
              },
            ],
          },
        }),
      );
      assert.equal(dup.results[0].status, 'DUPLICATE');
      assert.equal(dup.results[0].checkinId, first.results[0].checkinId);

      const conflictPayload = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: {
            tenantId,
            staffSessionId: session.sessionId,
            deviceId,
            clientClockAt,
            events: [
              {
                clientEventId: clientEventA,
                type: 'CHECKIN_OFFLINE',
                eventId,
                ticketId: ticketIds[2],
                clientOccurredAt: occurred,
                clientSeq: 0,
                payloadVersion: 1,
              },
            ],
          },
        }),
      );
      assert.equal(conflictPayload.results[0].status, 'REJECTED');
      assert.equal(
        conflictPayload.results[0].code,
        GATE_ERROR_CODES.OFFLINE_SYNC_IDEMPOTENCY_CONFLICT,
      );

      const rejectAfterPayload = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`
          SELECT COUNT(*)::int AS n
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action = 'gate.reject'
        `,
      );
      assert.equal(rejectAfterPayload[0].n, 1);

      // Replay same REJECTED payload — idempotent audit must not inflate rejectByReason.
      const conflictPayloadReplay = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: {
            tenantId,
            staffSessionId: session.sessionId,
            deviceId,
            clientClockAt,
            events: [
              {
                clientEventId: clientEventA,
                type: 'CHECKIN_OFFLINE',
                eventId,
                ticketId: ticketIds[2],
                clientOccurredAt: occurred,
                clientSeq: 0,
                payloadVersion: 1,
              },
            ],
          },
        }),
      );
      assert.equal(conflictPayloadReplay.results[0].status, 'REJECTED');
      const rejectAfterReplay = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`
          SELECT COUNT(*)::int AS n
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action = 'gate.reject'
        `,
      );
      assert.equal(rejectAfterReplay[0].n, 1);

      const hold = unwrapReserveOutcome(
        await withTenant(db, tenantId, (tx) =>
          reserveCheckin(tx, {
            tenantId,
            eventId,
            ticketId: ticketIds[2],
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      );
      unwrapConfirmOutcome(
        await withTenant(db, tenantId, (tx) =>
          confirmCheckin(tx, {
            tenantId,
            eventId,
            reservationId: hold.reservationId,
            token: hold.token,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      );

      const lostBody = {
        tenantId,
        staffSessionId: session.sessionId,
        deviceId,
        clientClockAt,
        events: [
          {
            clientEventId: clientEventC,
            type: 'CHECKIN_OFFLINE',
            eventId,
            ticketId: ticketIds[2],
            clientOccurredAt: occurred,
            clientSeq: 2,
            payloadVersion: 1,
          },
        ],
      };
      const lost = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: lostBody,
        }),
      );
      assert.equal(lost.results[0].status, 'CONFLICT');
      assert.equal(lost.results[0].code, GATE_ERROR_CODES.ALREADY_CHECKED_IN);
      assert.ok(lost.results[0].winningCheckinId);

      const rejectAfterConflict = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`
          SELECT COUNT(*)::int AS n
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action = 'gate.reject'
        `,
      );
      assert.equal(rejectAfterConflict[0].n, 2);

      const lostReplay = await withTenant(db, tenantId, (tx) =>
        applyOfflineSyncBatch(tx, {
          pathEventId: eventId,
          actorUserId: staff.userId,
          serverEpochMs: now,
          body: lostBody,
        }),
      );
      assert.equal(lostReplay.results[0].status, 'CONFLICT');
      const rejectAfterConflictReplay = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`
          SELECT COUNT(*)::int AS n
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action = 'gate.reject'
        `,
      );
      assert.equal(rejectAfterConflictReplay[0].n, 2);

      const counts = await withTenant(
        db,
        tenantId,
        (tx) =>
          tx.$queryRaw`
          SELECT
            (SELECT COUNT(*)::int FROM checkins WHERE tenant_id = ${tenantId}::uuid AND undone_at IS NULL) AS checkins,
            (SELECT COUNT(*)::int FROM offline_sync_events WHERE tenant_id = ${tenantId}::uuid) AS ledger,
            (SELECT COUNT(*)::int FROM audit_logs WHERE tenant_id = ${tenantId}::uuid AND action = 'gate.offline_sync.apply') AS audits
        `,
      );
      assert.equal(counts[0].checkins, 3);
      assert.equal(counts[0].ledger, 2);
      assert.equal(counts[0].audits, 2);

      // Two independent sessions race the same ticket. Arrival order, not an
      // asserted global ordering of client clocks across requests, chooses the winner.
      const secondSession = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staff.userId }),
      );
      const item = (ticketId, clientSeq, overrides = {}) => ({
        clientEventId: randomUUID(),
        type: 'CHECKIN_OFFLINE',
        eventId,
        ticketId,
        clientOccurredAt: occurred,
        clientSeq,
        payloadVersion: 1,
        ...overrides,
      });
      const runBatch = (body, actorUserId = staff.userId) =>
        withTenant(db, tenantId, (tx) =>
          applyOfflineSyncBatch(tx, {
            pathEventId: eventId,
            actorUserId,
            serverEpochMs: now,
            body,
          }),
        );
      const makeBody = (staffSessionId, events, overrides = {}) => ({
        tenantId,
        staffSessionId,
        deviceId: randomUUID(),
        clientClockAt,
        events,
        ...overrides,
      });
      const raceBodies = [session, secondSession].map((s) =>
        makeBody(s.sessionId, [item(ticketIds[3], 0)]),
      );
      const raced = await Promise.all(raceBodies.map((body) => runBatch(body)));
      assert.deepEqual(raced.map((r) => r.results[0].status).sort(), [
        'APPLIED',
        'CONFLICT',
      ]);
      const winner = raced.find((r) => r.results[0].status === 'APPLIED')
        .results[0];
      const loser = raced.find((r) => r.results[0].status === 'CONFLICT')
        .results[0];
      assert.equal(loser.code, GATE_ERROR_CODES.OFFLINE_SYNC_CONFLICT_LOST);
      assert.equal(loser.winningCheckinId, winner.checkinId);

      const duplicateItem = {
        ...raceBodies[raced.findIndex((r) => r.results[0].status === 'APPLIED')]
          .events[0],
      };
      const mixed = makeBody(session.sessionId, [
        item(ticketIds[4], 5),
        item(randomUUID(), 4),
        item(ticketIds[3], 3),
        duplicateItem,
      ]);
      const mixedResult = await runBatch(mixed);
      assert.deepEqual(
        mixedResult.results.map((r) => r.status),
        ['DUPLICATE', 'CONFLICT', 'REJECTED', 'APPLIED'],
      );
      assert.equal(mixedResult.results[1].winningCheckinId, winner.checkinId);
      assert.equal(
        mixedResult.results[2].code,
        GATE_ERROR_CODES.TICKET_NOT_FOUND,
      );
      const auditSnapshot = () =>
        withTenant(
          db,
          tenantId,
          (tx) => tx.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM checkins WHERE tenant_id = ${tenantId}::uuid AND ticket_id = ${ticketIds[3]}::uuid AND undone_at IS NULL) AS current,
          (SELECT COUNT(*)::int FROM offline_sync_events WHERE tenant_id = ${tenantId}::uuid) AS ledger,
          (SELECT COUNT(*)::int FROM audit_logs WHERE tenant_id = ${tenantId}::uuid AND action = 'gate.offline_sync.apply') AS applied,
          (SELECT COUNT(*)::int FROM audit_logs WHERE tenant_id = ${tenantId}::uuid AND action = 'gate.reject') AS rejected
      `,
        );
      const beforeRetry = (await auditSnapshot())[0];
      assert.deepEqual(beforeRetry, {
        current: 1,
        ledger: 4,
        applied: 4,
        rejected: 5,
      });
      const retried = await runBatch(mixed);
      assert.deepEqual(
        retried.results.map((r) => r.status),
        ['DUPLICATE', 'REJECTED', 'REJECTED', 'DUPLICATE'],
      );
      assert.equal(
        retried.results[1].code,
        GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      );
      assert.equal(
        retried.results[2].code,
        GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      );
      const afterRetry = (await auditSnapshot())[0];
      assert.deepEqual(afterRetry, {
        ...beforeRetry,
        rejected: beforeRetry.rejected + 2,
      });
      await assert.rejects(
        () => runBatch(mixed, guest.userId),
        (error) => error.code === 'MEMBERSHIP_REQUIRED',
      );
      await assert.rejects(
        () => runBatch({ ...mixed, staffSessionId: randomUUID() }),
        (error) => error.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      );
      assert.deepEqual((await auditSnapshot())[0], afterRetry);

      // Validation boundaries use a fixed server clock, avoiding timing-dependent
      // assertions at exactly 300 seconds.
      const valid = item(ticketIds[4], 0);
      const body = makeBody(session.sessionId, [valid]);
      for (const delta of [-300000, 300000]) {
        const boundary = new Date(now + delta).toISOString();
        validateOfflineSyncRequest(
          eventId,
          {
            ...body,
            clientClockAt: boundary,
            events: [{ ...valid, clientOccurredAt: boundary }],
          },
          now,
        );
      }
      for (const delta of [-300001, 300001]) {
        const outside = new Date(now + delta).toISOString();
        for (const invalid of [
          { ...body, clientClockAt: outside },
          { ...body, events: [{ ...valid, clientOccurredAt: outside }] },
        ]) {
          assert.throws(
            () => validateOfflineSyncRequest(eventId, invalid, now),
            (error) =>
              error.code === GATE_ERROR_CODES.OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED,
          );
        }
      }
      const fifty = Array.from({ length: 50 }, (_, i) => item(ticketIds[4], i));
      assert.equal(
        validateOfflineSyncRequest(eventId, { ...body, events: fifty }, now)
          .events.length,
        50,
      );
      assert.throws(
        () =>
          validateOfflineSyncRequest(
            eventId,
            { ...body, events: [...fifty, item(ticketIds[4], 50)] },
            now,
          ),
        (error) => error.code === GATE_ERROR_CODES.OFFLINE_SYNC_BATCH_TOO_LARGE,
      );
      const order = [
        item(ticketIds[4], 1, {
          clientEventId: '22222222-2222-4222-8222-222222222222',
        }),
        item(ticketIds[4], 1, {
          clientEventId: '11111111-1111-4111-8111-111111111111',
        }),
        item(ticketIds[4], 0),
        item(ticketIds[4], 9, {
          clientOccurredAt: new Date(now - 6000).toISOString(),
        }),
      ];
      assert.deepEqual(
        validateOfflineSyncRequest(
          eventId,
          { ...body, events: order },
          now,
        ).events.map((e) => e.clientEventId),
        [order[3], order[2], order[1], order[0]].map((e) => e.clientEventId),
      );
      for (const [invalid, code] of [
        [
          { ...valid, eventId: randomUUID() },
          GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
        ],
        [
          { ...valid, payloadVersion: 2 },
          GATE_ERROR_CODES.OFFLINE_SYNC_PAYLOAD_VERSION_UNSUPPORTED,
        ],
        [
          { ...valid, clientSeq: -1 },
          GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
        ],
      ]) {
        assert.throws(
          () =>
            validateOfflineSyncRequest(
              eventId,
              {
                ...body,
                events: [valid, { ...invalid, clientEventId: randomUUID() }],
              },
              now,
            ),
          (error) => error.code === code,
        );
      }
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) stopContainer(name);
    }
  },
);
