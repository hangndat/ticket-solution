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
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  holdCodeForReview,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readEventReport,
  AuthzError,
  AUTHZ_ERROR_CODES,
  claimOutboxBatch,
  relayOutboxOnce,
  createFailingEmailAdapter,
  createNoopEmailAdapter,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  undoCheckin,
  recordGateReject,
  GATE_ERROR_CODES,
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

async function redeemOutsideTx(db, input) {
  const outcome = await withTenant(db, input.tenantId, (tx) =>
    redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, input),
  );
  return unwrapRedeemOutcome(outcome);
}

function countingAdapter() {
  const calls = [];
  return {
    calls,
    adapter: {
      async sendTicketIssued(payload) {
        calls.push(payload.ticketId);
        return {
          providerRef: 'count:' + payload.ticketId,
          providerStatus: 'ACCEPTED',
        };
      },
    },
  };
}

test(
  'event report counts are aggregate-only; claim waits and does not resend SENT',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const reporter = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'reporter',
        email: 'reporter@example.com',
        emailVerified: true,
      });
      const clerk = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'clerk',
        email: 'clerk@example.com',
        emailVerified: true,
      });
      const unassigned = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'unassigned',
        email: 'unassigned@example.com',
        emailVerified: true,
      });
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'attendee',
        email: 'attendee@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const otherEventId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      const seeded = await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'report', name: 'Report' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'launch',
            name: 'Launch',
            status: 'DRAFT',
          },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: otherEventId,
            slug: 'other',
            name: 'Other',
            status: 'DRAFT',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: reporter.userId,
          role: 'MANAGER',
          permissions: ['report.read'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['report.read'],
        });
        const reporterMembershipId = membership.membershipId;
        const clerkMembership = await grantMembership(tx, {
          tenantId,
          userId: clerk.userId,
          role: 'CLERK',
          permissions: ['inventory.import'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: clerkMembership.membershipId,
          permissions: ['inventory.import'],
        });
        await grantMembership(tx, {
          tenantId,
          userId: unassigned.userId,
          role: 'MANAGER',
          permissions: ['report.read'],
        });
        const primary = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: [
            'KEEP-1',
            'USED-1',
            'REVOKED-1',
            'HOLD-1',
            'WAIT-1',
            'SENT-1',
          ],
        });
        const other = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId: otherEventId,
          eventQuota: 2,
          rawCodes: ['OTHER-1'],
        });
        await holdCodeForReview(tx, {
          tenantId,
          eventId,
          codeId: primary.codeIds[3],
          ownerUserId: attendee.userId,
        });
        return { primary, other, reporterMembershipId };
      });

      const issue = (event, rawCode) =>
        redeemOutsideTx(db, {
          tenantId,
          eventId: event,
          actorUserId: attendee.userId,
          actorEmail: attendee.email,
          emailVerified: true,
          rawCode,
          idempotencyKey: randomUUID(),
        });

      const kept = await issue(eventId, 'KEEP-1');
      const used = await issue(eventId, 'USED-1');
      const revoked = await issue(eventId, 'REVOKED-1');
      const otherIssued = await issue(otherEventId, 'OTHER-1');
      assert.ok(
        kept.ticketId &&
          used.ticketId &&
          revoked.ticketId &&
          otherIssued.ticketId,
      );

      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE tickets SET state = 'USED', updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid AND id = ${used.ticketId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE tickets SET state = 'REVOKED', updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid AND id = ${revoked.ticketId}::uuid
        `;
      });

      const report = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(report.eventId, eventId);
      assert.deepEqual(report.ticketsByState, {
        ACTIVE: 1,
        REVOKED: 1,
        CANCELLED: 0,
        USED: 1,
      });
      assert.deepEqual(report.quota, { capacity: 10, allocated: 3 });
      assert.equal(report.quotaRemaining, 7);
      assert.equal(report.quotaCapacityState, 'FINITE');
      assert.equal(report.pendingApprovalCount, 1);
      assert.equal(report.checkInSuccessCount, 0);
      assert.deepEqual(report.rejectByReason, {});
      assert.equal(report.emailNeedsCsCount, 0);
      assert.equal(typeof report.asOf, 'string');
      assert.ok(!Number.isNaN(Date.parse(report.asOf)), 'asOf must be ISO');
      const serialized = JSON.stringify(report);
      assert.equal(serialized.includes('attendee@example.com'), false);
      assert.equal(serialized.includes('KEEP-1'), false);
      assert.equal(serialized.includes(seeded.primary.codeIds[0]), false);
      assert.equal(Object.hasOwn(report, 'email'), false);

      // O12: checkInSuccessCount follows current checkins, not tickets.state=USED alone.
      const gateStaff = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'gate-staff',
        email: 'gate-staff@example.com',
        emailVerified: true,
      });
      await withTenant(db, tenantId, async (tx) => {
        const membership = await grantMembership(tx, {
          tenantId,
          userId: gateStaff.userId,
          role: 'STAFF',
          permissions: ['gate.confirm', 'gate.undo'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['gate.confirm', 'gate.undo'],
        });
      });
      const session = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: gateStaff.userId,
        }),
      );
      const hold = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: kept.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: gateStaff.userId,
        }),
      );
      const confirmed = await withTenant(db, tenantId, (tx) =>
        confirmCheckin(tx, {
          tenantId,
          eventId,
          reservationId: hold.reservationId,
          token: hold.token,
          staffSessionId: session.sessionId,
          actorUserId: gateStaff.userId,
        }),
      );
      await withTenant(db, tenantId, (tx) =>
        recordGateReject(tx, {
          tenantId,
          eventId,
          actorUserId: gateStaff.userId,
          reason: GATE_ERROR_CODES.ALREADY_CHECKED_IN,
          resourceType: 'ticket',
          resourceId: kept.ticketId,
        }),
      );
      const afterConfirm = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(afterConfirm.checkInSuccessCount, 1);
      assert.equal(afterConfirm.ticketsByState.USED, 2);
      assert.equal(afterConfirm.ticketsByState.ACTIVE, 0);
      assert.deepEqual(afterConfirm.rejectByReason, {
        [GATE_ERROR_CODES.ALREADY_CHECKED_IN]: 1,
      });

      await withTenant(db, tenantId, (tx) =>
        undoCheckin(tx, {
          tenantId,
          eventId,
          checkinId: confirmed.checkinId,
          actorUserId: gateStaff.userId,
          reason: 'supervisor undo for report fixture',
        }),
      );
      const afterUndo = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(afterUndo.checkInSuccessCount, 0);
      assert.equal(afterUndo.ticketsByState.USED, 1);
      assert.equal(afterUndo.ticketsByState.ACTIVE, 1);

      // O12 quota: UNLIMITED (capacity null) vs MISSING_BUCKET — never fake remaining 0.
      const unlimitedEventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const missingBucketEventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await withTenant(db, tenantId, async (tx) => {
        await tx.event.create({
          data: {
            tenantId,
            id: unlimitedEventId,
            slug: 'unlimited',
            name: 'Unlimited',
            status: 'DRAFT',
          },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: missingBucketEventId,
            slug: 'missing-bucket',
            name: 'Missing bucket',
            status: 'DRAFT',
          },
        });
        await tx.$executeRaw`
          INSERT INTO quota_buckets (
            tenant_id, event_id, id, scope, scope_id, capacity, allocated
          ) VALUES (
            ${tenantId}::uuid,
            ${unlimitedEventId}::uuid,
            ${randomUUID()}::uuid,
            'EVENT',
            NULL,
            NULL,
            4
          )
        `;
        await grantEventAssignment(tx, {
          tenantId,
          eventId: unlimitedEventId,
          membershipId: seeded.reporterMembershipId,
          permissions: ['report.read'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId: missingBucketEventId,
          membershipId: seeded.reporterMembershipId,
          permissions: ['report.read'],
        });
      });
      const unlimitedReport = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId: unlimitedEventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(unlimitedReport.quotaCapacityState, 'UNLIMITED');
      assert.equal(unlimitedReport.quota.capacity, null);
      assert.equal(unlimitedReport.quota.allocated, 4);
      assert.equal(unlimitedReport.quotaRemaining, null);

      const missingReport = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId: missingBucketEventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(missingReport.quotaCapacityState, 'MISSING_BUCKET');
      assert.equal(missingReport.quota.capacity, null);
      assert.equal(missingReport.quota.allocated, 0);
      assert.equal(missingReport.quotaRemaining, null);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            readEventReport(tx, {
              tenantId,
              eventId,
              actorUserId: clerk.userId,
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            readEventReport(tx, {
              tenantId,
              eventId,
              actorUserId: unassigned.userId,
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            readEventReport(tx, {
              tenantId,
              eventId: otherEventId,
              actorUserId: reporter.userId,
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      );

      const drained = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'drain',
        10,
        RELAY_OPTS,
      );
      assert.ok(drained.completed >= 4);

      const waiting = await issue(eventId, 'WAIT-1');
      const failed = await relayOutboxOnce(
        db,
        createFailingEmailAdapter('smtp down'),
        'fail-once',
        10,
        RELAY_OPTS,
      );
      assert.ok(failed.failed >= 1);
      const tooSoon = await claimOutboxBatch(db, 'too-soon', 10);
      assert.equal(
        tooSoon.some((row) => row.aggregate_id === waiting.ticketId),
        false,
      );
      const waitingRow = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT n.state AS note_state,
                 n.next_attempt_at > clock_timestamp() AS waiting,
                 o.next_attempt_at > clock_timestamp() AS outbox_waiting,
                 o.status AS outbox_status
          FROM notifications n
          JOIN outbox o
            ON o.tenant_id = n.tenant_id
           AND o.aggregate_id = ${waiting.ticketId}::uuid
          WHERE n.tenant_id = ${tenantId}::uuid
            AND n.business_key = ${'ticket:' + waiting.ticketId + ':issued:email'}
        `;
        return rows[0];
      });
      assert.equal(waitingRow.note_state, 'FAILED');
      assert.equal(waitingRow.waiting, true);
      assert.equal(waitingRow.outbox_waiting, true);
      assert.equal(waitingRow.outbox_status, 'PENDING');

      // Temporary FAILED (retry scheduled) must not inflate emailNeedsCsCount.
      const midFailReport = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(midFailReport.emailNeedsCsCount, 0);

      const alreadySent = await issue(eventId, 'SENT-1');
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE notifications
          SET state = 'ACCEPTED', provider_ref = 'already', updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + alreadySent.ticketId + ':issued:email'}
        `;
      });
      const counter = countingAdapter();
      const sentRelay = await relayOutboxOnce(
        db,
        counter.adapter,
        'sent-once',
        10,
        RELAY_OPTS,
      );
      assert.equal(counter.calls.includes(alreadySent.ticketId), false);
      assert.equal(counter.calls.includes(waiting.ticketId), false);
      assert.ok(sentRelay.completed >= 1);
      const sentOutbox = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${alreadySent.ticketId}::uuid
        `;
        return rows[0].status;
      });
      assert.equal(sentOutbox, 'COMPLETE');

      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE notifications
          SET next_attempt_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + waiting.ticketId + ':issued:email'}
        `;
        await tx.$executeRaw`
          UPDATE outbox
          SET next_attempt_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${waiting.ticketId}::uuid
        `;
      });
      const retryCounter = countingAdapter();
      const retried = await relayOutboxOnce(
        db,
        retryCounter.adapter,
        'retry-due',
        10,
        RELAY_OPTS,
      );
      assert.deepEqual(retryCounter.calls, [waiting.ticketId]);
      assert.ok(retried.completed >= 1);

      // Terminal delivery DEAD = needs CS; revoke/cancel DEAD must not count.
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, kind,
            state, attempts, last_error, payload
          ) VALUES (
            ${tenantId}::uuid,
            ${eventId}::uuid,
            ${randomUUID()}::uuid,
            ${'ticket:' + randomUUID() + ':issued:email'},
            'email',
            'TicketIssued',
            'DEAD',
            5,
            'smtp down',
            '{}'::jsonb
          )
        `;
      });
      const deadReport = await withTenant(db, tenantId, (tx) =>
        readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: reporter.userId,
        }),
      );
      assert.equal(deadReport.emailNeedsCsCount, 1);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
