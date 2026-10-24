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
  revokeStaffSession,
  undoCheckin,
  revokeTicket,
  applyOfflineSyncBatch,
  lookupOfflineSyncReceipt,
  deriveOfflineSyncReceiptCheckinState,
  revokeMembership,
  revokeEventAssignment,
  GateError,
  GATE_ERROR_CODES,
  AuthzError,
  AUTHZ_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: '859-receipt-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = '859-receipt-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-859-receipt-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=ticket_fixall_859_receipt_test',
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
        'ticket_fixall_859_receipt_test',
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
      '/ticket_fixall_859_receipt_test',
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
      "CREATE ROLE receipt_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO receipt_login');
    const host = '127.0.0.1:' + port;
    return {
      name,
      password,
      url:
        'postgresql://receipt_login:' +
        password +
        '@' +
        host +
        '/ticket_fixall_859_receipt_test',
      adminUrl:
        'postgresql://postgres:' + password + '@' + host + '/ticket_fixall_859_receipt_test',
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

async function seedStaffEvent(
  db,
  { tenantId, eventId, staffUserId, permissions, tenantSlug = 'receipt-tenant' },
) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: tenantSlug, name: 'Receipt' },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug: 'receipt-event',
        name: 'Receipt Event',
        status: 'PUBLISHED',
      },
    });
    await seedEventInventory(tx, HMAC, {
      tenantId,
      eventId,
      eventQuota: 5,
      rawCodes: ['RCP-A', 'RCP-B'],
    });
    const membership = await grantMembership(tx, {
      tenantId,
      userId: staffUserId,
      role: 'STAFF',
      permissions,
    });
    await grantEventAssignment(tx, {
      tenantId,
      eventId,
      membershipId: membership.membershipId,
      permissions,
    });
  });
}

async function issueTicket(db, tenantId, eventId, guest) {
  return unwrapRedeemOutcome(
    await withTenant(db, tenantId, (tx) =>
      redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
        tenantId,
        eventId,
        actorUserId: guest.userId,
        actorEmail: guest.email,
        emailVerified: true,
        rawCode: 'RCP-A',
        idempotencyKey: randomUUID(),
      }),
    ),
  ).ticketId;
}

async function applyOneOffline(db, input) {
  const now = Date.now();
  return withTenant(db, input.tenantId, (tx) =>
    applyOfflineSyncBatch(tx, {
      pathEventId: input.eventId,
      actorUserId: input.actorUserId,
      serverEpochMs: now,
      body: {
        tenantId: input.tenantId,
        staffSessionId: input.staffSessionId,
        deviceId: input.deviceId,
        clientClockAt: new Date(now).toISOString(),
        events: [
          {
            clientEventId: input.clientEventId,
            type: 'CHECKIN_OFFLINE',
            eventId: input.eventId,
            ticketId: input.ticketId,
            clientOccurredAt: new Date(now - 5000).toISOString(),
            clientSeq: 0,
            payloadVersion: 1,
          },
        ],
      },
    }),
  );
}

test(
  'offline receipt lookup: matrix authz, states, closed window, read-only',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const staffA = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-a-receipt',
        email: 'staff-a-receipt@example.com',
        emailVerified: true,
      });
      const staffB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-b-receipt',
        email: 'staff-b-receipt@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'guest-receipt',
        email: 'guest-receipt@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const otherEventId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const deviceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

      await seedStaffEvent(db, {
        tenantId,
        eventId,
        staffUserId: staffA.userId,
        permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
      });
      await withTenant(db, tenantId, async (tx) => {
        await tx.event.create({
          data: {
            tenantId,
            id: otherEventId,
            slug: 'other-event',
            name: 'Other',
            status: 'PUBLISHED',
          },
        });
        const membershipB = await grantMembership(tx, {
          tenantId,
          userId: staffB.userId,
          role: 'STAFF',
          permissions: ['gate.confirm'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membershipB.membershipId,
          permissions: ['gate.confirm'],
        });
        const existingA = await tx.membership.findFirst({
          where: { tenantId, userId: staffA.userId },
        });
        assert.ok(existingA);
        await grantEventAssignment(tx, {
          tenantId,
          eventId: otherEventId,
          membershipId: existingA.id,
          permissions: ['gate.confirm'],
        });
      });

      const ticketId = await issueTicket(db, tenantId, eventId, guest);
      const sessionA = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staffA.userId,
        }),
      );
      const clientEventId = randomUUID();
      const applied = await applyOneOffline(db, {
        tenantId,
        eventId,
        actorUserId: staffA.userId,
        staffSessionId: sessionA.sessionId,
        deviceId,
        ticketId,
        clientEventId,
      });
      assert.equal(applied.results[0].status, 'APPLIED');

      const countsBefore = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT
            (SELECT COUNT(*)::int FROM offline_sync_events WHERE tenant_id = ${tenantId}::uuid) AS ledger,
            (SELECT COUNT(*)::int FROM checkins WHERE tenant_id = ${tenantId}::uuid) AS checkins
        `,
      );

      const current = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId,
          actorUserId: staffA.userId,
        }),
      );
      assert.equal(current.historical, true);
      assert.equal(current.status, 'APPLIED');
      assert.equal(current.checkinState, 'CURRENT');
      assert.equal(current.clientEventId, clientEventId);
      assert.equal(current.staffSessionId, sessionA.sessionId);

      const countsAfter = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT
            (SELECT COUNT(*)::int FROM offline_sync_events WHERE tenant_id = ${tenantId}::uuid) AS ledger,
            (SELECT COUNT(*)::int FROM checkins WHERE tenant_id = ${tenantId}::uuid) AS checkins
        `,
      );
      assert.deepEqual(countsAfter[0], countsBefore[0]);

      const sessionB = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staffB.userId,
        }),
      );
      assert.ok(sessionB.sessionId);
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId,
              actorUserId: staffB.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
          return true;
        },
      );

      const sessionOnOther = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId: otherEventId,
          userId: staffA.userId,
        }),
      );
      assert.ok(sessionOnOther.sessionId);
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: otherEventId,
              clientEventId,
              actorUserId: staffA.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
          return true;
        },
      );

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId: randomUUID(),
              actorUserId: staffA.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
          return true;
        },
      );

      await withTenant(db, tenantId, (tx) =>
        undoCheckin(tx, {
          tenantId,
          eventId,
          checkinId: current.checkinId,
          actorUserId: staffA.userId,
          reason: 'test undo',
        }),
      );
      const undone = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId,
          actorUserId: staffA.userId,
        }),
      );
      assert.equal(undone.checkinState, 'UNDONE');

      const clientEventRevoke = randomUUID();
      const ticketB = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'RCP-B',
            idempotencyKey: randomUUID(),
          }),
        ),
      ).ticketId;
      await applyOneOffline(db, {
        tenantId,
        eventId,
        actorUserId: staffA.userId,
        staffSessionId: sessionA.sessionId,
        deviceId,
        ticketId: ticketB,
        clientEventId: clientEventRevoke,
      });
      await withTenant(db, tenantId, (tx) =>
        revokeTicket(tx, {
          tenantId,
          eventId,
          ticketId: ticketB,
          actorUserId: staffA.userId,
          reason: 'revoke test',
        }),
      );
      const revoked = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId: clientEventRevoke,
          actorUserId: staffA.userId,
        }),
      );
      assert.equal(revoked.checkinState, 'TICKET_REVOKED');

      await withTenant(db, tenantId, (tx) =>
        tx.$executeRaw`
          UPDATE events
          SET check_in_closes_at = clock_timestamp() - interval '1 hour'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
        `,
      );
      const closedWindow = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId,
          actorUserId: staffA.userId,
        }),
      );
      assert.equal(closedWindow.checkinState, 'UNDONE');

      await withTenant(db, tenantId, (tx) =>
        revokeStaffSession(tx, {
          tenantId,
          eventId,
          sessionId: sessionA.sessionId,
          actorUserId: staffA.userId,
        }),
      );
      const sessionA2 = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staffA.userId,
        }),
      );
      const afterNewSession = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId,
          actorUserId: staffA.userId,
        }),
      );
      assert.equal(afterNewSession.staffSessionId, sessionA.sessionId);
      assert.equal(afterNewSession.checkinState, 'UNDONE');
      assert.notEqual(sessionA2.sessionId, sessionA.sessionId);

      const tenant2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const tenant2EventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await seedStaffEvent(db, {
        tenantId: tenant2Id,
        eventId: tenant2EventId,
        staffUserId: staffB.userId,
        permissions: ['gate.confirm'],
        tenantSlug: 'receipt-tenant-b',
      });
      const sessionT2 = await withTenant(db, tenant2Id, (tx) =>
        openStaffSession(tx, {
          tenantId: tenant2Id,
          eventId: tenant2EventId,
          userId: staffB.userId,
        }),
      );
      assert.ok(sessionT2.sessionId);
      await assert.rejects(
        () =>
          withTenant(db, tenant2Id, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId: tenant2Id,
              pathEventId: tenant2EventId,
              clientEventId,
              actorUserId: staffB.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
          return true;
        },
      );

      const membershipB = await withTenant(db, tenantId, (tx) =>
        tx.membership.findFirst({
          where: { tenantId, userId: staffB.userId },
        }),
      );
      assert.ok(membershipB);
      await withTenant(db, tenantId, (tx) =>
        revokeMembership(tx, tenantId, membershipB.id),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId,
              actorUserId: staffB.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof AuthzError);
          assert.equal(err.code, AUTHZ_ERROR_CODES.MEMBERSHIP_REVOKED);
          return true;
        },
      );

      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      await admin.query(
        `UPDATE offline_sync_events
         SET staff_session_id = $1::uuid
         WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
        [sessionB.sessionId, tenantId, clientEventId],
      );
      await admin.end();
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId,
              actorUserId: staffA.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
          return true;
        },
      );

      const fkAdmin = new Client({ connectionString: boot.adminUrl });
      await fkAdmin.connect();
      await assert.rejects(
        () =>
          fkAdmin.query(
            `DELETE FROM checkins
             WHERE tenant_id = $1::uuid AND id = $2::uuid`,
            [tenantId, current.checkinId],
          ),
        (err) => {
          assert.match(String(err.message), /violates foreign key|restrict/i);
          return true;
        },
      );
      await fkAdmin.end();

      await withTenant(db, tenantId, (tx) =>
        revokeStaffSession(tx, {
          tenantId,
          eventId,
          sessionId: sessionA2.sessionId,
          actorUserId: staffA.userId,
        }),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId,
              actorUserId: staffA.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof GateError);
          assert.equal(err.code, GATE_ERROR_CODES.SESSION_NOT_ACTIVE);
          return true;
        },
      );

      const membershipA = await withTenant(db, tenantId, (tx) =>
        tx.membership.findFirst({
          where: { tenantId, userId: staffA.userId },
        }),
      );
      assert.ok(membershipA);
      const sessionA3 = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staffA.userId,
        }),
      );
      assert.ok(sessionA3.sessionId);
      const assignmentA = await withTenant(db, tenantId, (tx) =>
        tx.eventAssignment.findFirst({
          where: {
            tenantId,
            eventId,
            membershipId: membershipA.id,
            revokedAt: null,
          },
        }),
      );
      assert.ok(assignmentA);
      await withTenant(db, tenantId, (tx) =>
        revokeEventAssignment(tx, tenantId, assignmentA.id),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupOfflineSyncReceipt(tx, {
              tenantId,
              pathEventId: eventId,
              clientEventId,
              actorUserId: staffA.userId,
            }),
          ),
        (err) => {
          assert.ok(err instanceof AuthzError);
          assert.equal(err.code, AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED);
          return true;
        },
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) stopContainer(name);
    }
  },
);

async function assertReceiptNotFound(db, input) {
  await assert.rejects(
    () =>
      withTenant(db, input.tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId: input.tenantId,
          pathEventId: input.eventId,
          clientEventId: input.clientEventId,
          actorUserId: input.actorUserId,
        }),
      ),
    (err) => {
      assert.ok(err instanceof GateError);
      assert.equal(err.code, GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND);
      return true;
    },
  );
}

test(
  'offline receipt PG evidence F02-EVID-01: NO_LONGER_CURRENT and corrupt join',
  { timeout: 240000 },
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
        subject: 'staff-evid-receipt',
        email: 'staff-evid-receipt@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'guest-evid-receipt',
        email: 'guest-evid-receipt@example.com',
        emailVerified: true,
      });

      const tenantId = 'd1111111-1111-4111-8111-111111111111';
      const eventId = 'd2222222-2222-4222-8222-222222222222';
      const deviceId = 'd3333333-3333-4333-8333-333333333333';

      await seedStaffEvent(db, {
        tenantId,
        eventId,
        staffUserId: staff.userId,
        permissions: ['gate.confirm'],
        tenantSlug: 'evid-receipt-tenant',
      });

      const ticketA = await issueTicket(db, tenantId, eventId, guest);
      const ticketB = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'RCP-B',
            idempotencyKey: randomUUID(),
          }),
        ),
      ).ticketId;

      const session = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staff.userId,
        }),
      );

      const clientEventA = randomUUID();
      await applyOneOffline(db, {
        tenantId,
        eventId,
        actorUserId: staff.userId,
        staffSessionId: session.sessionId,
        deviceId,
        ticketId: ticketA,
        clientEventId: clientEventA,
      });
      const clientEventB = randomUUID();
      const appliedB = await applyOneOffline(db, {
        tenantId,
        eventId,
        actorUserId: staff.userId,
        staffSessionId: session.sessionId,
        deviceId,
        ticketId: ticketB,
        clientEventId: clientEventB,
      });
      assert.equal(appliedB.results[0].status, 'APPLIED');

      const ledgerRows = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT ticket_id, checkin_id
          FROM offline_sync_events
          WHERE tenant_id = ${tenantId}::uuid
            AND client_event_id = ${clientEventA}::uuid
        `,
      );
      assert.equal(ledgerRows.length, 1);
      const ledgerCheckinA = ledgerRows[0].checkin_id;
      const ledgerRowsB = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT checkin_id FROM offline_sync_events
          WHERE tenant_id = ${tenantId}::uuid
            AND client_event_id = ${clientEventB}::uuid
        `,
      );
      const checkinB = ledgerRowsB[0].checkin_id;
      assert.notEqual(ledgerCheckinA, checkinB);

      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();

      await admin.query(
        `UPDATE tickets SET state = 'ACTIVE'
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, ticketA],
      );
      const nlc = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId: clientEventA,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(nlc.status, 'APPLIED');
      assert.equal(nlc.historical, true);
      assert.equal(nlc.checkinState, 'NO_LONGER_CURRENT');
      assert.equal(nlc.checkinId, ledgerCheckinA);
      await admin.query(
        `UPDATE tickets SET state = 'USED'
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [tenantId, ticketA],
      );

      const savedCheckinA = ledgerCheckinA;
      await admin.query(
        `UPDATE offline_sync_events
         SET checkin_id = $1::uuid
         WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
        [checkinB, tenantId, clientEventA],
      );
      await assertReceiptNotFound(db, {
        tenantId,
        eventId,
        clientEventId: clientEventA,
        actorUserId: staff.userId,
      });
      await admin.query(
        `UPDATE offline_sync_events
         SET checkin_id = $1::uuid
         WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
        [savedCheckinA, tenantId, clientEventA],
      );

      const savedTicketA = ticketA;
      await admin.query(
        `UPDATE offline_sync_events
         SET ticket_id = $1::uuid
         WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
        [ticketB, tenantId, clientEventA],
      );
      await assertReceiptNotFound(db, {
        tenantId,
        eventId,
        clientEventId: clientEventA,
        actorUserId: staff.userId,
      });
      await admin.query(
        `UPDATE offline_sync_events
         SET ticket_id = $1::uuid
         WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
        [savedTicketA, tenantId, clientEventA],
      );

      const fkDefs = await admin.query(`
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'offline_sync_events'
          AND c.contype = 'f'
          AND c.conname IN (
            'offline_sync_events_checkin_fk',
            'offline_sync_events_ticket_fk'
          )
        ORDER BY c.conname
      `);
      assert.equal(fkDefs.rows.length, 2);
      for (const row of fkDefs.rows) {
        assert.match(row.def, /ON DELETE RESTRICT/i);
        assert.match(row.def, /REFERENCES checkins|REFERENCES tickets/i);
      }

      await assert.rejects(
        () =>
          admin.query(
            `DELETE FROM checkins
             WHERE tenant_id = $1::uuid AND id = $2::uuid`,
            [tenantId, savedCheckinA],
          ),
        (err) => {
          assert.match(String(err.message), /violates foreign key|restrict/i);
          return true;
        },
      );
      await assert.rejects(
        () =>
          admin.query(
            `DELETE FROM tickets
             WHERE tenant_id = $1::uuid AND id = $2::uuid`,
            [tenantId, savedTicketA],
          ),
        (err) => {
          assert.match(String(err.message), /violates foreign key|restrict/i);
          return true;
        },
      );
      const orphanCheckinId = randomUUID();
      await assert.rejects(
        () =>
          admin.query(
            `UPDATE offline_sync_events
             SET checkin_id = $1::uuid
             WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
            [orphanCheckinId, tenantId, clientEventA],
          ),
        (err) => {
          assert.match(String(err.message), /violates foreign key/i);
          return true;
        },
      );
      const orphanTicketId = randomUUID();
      await assert.rejects(
        () =>
          admin.query(
            `UPDATE offline_sync_events
             SET ticket_id = $1::uuid
             WHERE tenant_id = $2::uuid AND client_event_id = $3::uuid`,
            [orphanTicketId, tenantId, clientEventA],
          ),
        (err) => {
          assert.match(String(err.message), /violates foreign key/i);
          return true;
        },
      );

      await admin.end();

      const restored = await withTenant(db, tenantId, (tx) =>
        lookupOfflineSyncReceipt(tx, {
          tenantId,
          pathEventId: eventId,
          clientEventId: clientEventA,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(restored.checkinState, 'CURRENT');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) stopContainer(name);
    }
  },
);

test('deriveOfflineSyncReceiptCheckinState precedence', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(
    deriveOfflineSyncReceiptCheckinState({
      ticketState: 'REVOKED',
      checkinUndoneAt: null,
      ledgerCheckinId: id,
      currentCheckinId: id,
    }),
    'TICKET_REVOKED',
  );
  assert.equal(
    deriveOfflineSyncReceiptCheckinState({
      ticketState: 'USED',
      checkinUndoneAt: new Date(),
      ledgerCheckinId: id,
      currentCheckinId: id,
    }),
    'UNDONE',
  );
  assert.equal(
    deriveOfflineSyncReceiptCheckinState({
      ticketState: 'USED',
      checkinUndoneAt: null,
      ledgerCheckinId: id,
      currentCheckinId: id,
    }),
    'CURRENT',
  );
  assert.equal(
    deriveOfflineSyncReceiptCheckinState({
      ticketState: 'USED',
      checkinUndoneAt: null,
      ledgerCheckinId: id,
      currentCheckinId: '22222222-2222-4222-8222-222222222222',
    }),
    'NO_LONGER_CURRENT',
  );
});

test('lookup rejects malformed UUID at validation layer', async () => {
  const db = { $transaction: async () => {} };
  await assert.rejects(
    () =>
      lookupOfflineSyncReceipt(db, {
        tenantId: 'not-a-uuid',
        pathEventId: randomUUID(),
        clientEventId: randomUUID(),
        actorUserId: randomUUID(),
      }),
    (err) => {
      assert.ok(err instanceof GateError);
      return true;
    },
  );
});
