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
  '202610170007_d4_manual_approval',
  '202610170008_d4_report_retry',
  '202610170009_n1_notification_delivery',
].map((name) =>
  path.join(__dirname, '../prisma/migrations', name, 'migration.sql'),
);

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
        return { primary, other };
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
      assert.deepEqual(report, {
        eventId,
        ticketsByState: { ACTIVE: 1, REVOKED: 1, CANCELLED: 0, USED: 1 },
        quota: { capacity: 10, allocated: 3 },
        pendingApprovalCount: 1,
      });
      const serialized = JSON.stringify(report);
      assert.equal(serialized.includes('attendee@example.com'), false);
      assert.equal(serialized.includes('KEEP-1'), false);
      assert.equal(serialized.includes(seeded.primary.codeIds[0]), false);
      assert.equal(Object.hasOwn(report, 'email'), false);

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
