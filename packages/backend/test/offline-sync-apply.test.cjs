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
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
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
          rawCodes: ['OFF-A', 'OFF-B', 'OFF-C'],
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
      for (const code of ['OFF-A', 'OFF-B', 'OFF-C']) {
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

      const rejectAfterPayload = await withTenant(db, tenantId, (tx) =>
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
      const rejectAfterReplay = await withTenant(db, tenantId, (tx) =>
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

      const rejectAfterConflict = await withTenant(db, tenantId, (tx) =>
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
      const rejectAfterConflictReplay = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT COUNT(*)::int AS n
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action = 'gate.reject'
        `,
      );
      assert.equal(rejectAfterConflictReplay[0].n, 2);

      const counts = await withTenant(db, tenantId, (tx) =>
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
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) stopContainer(name);
    }
  },
);
