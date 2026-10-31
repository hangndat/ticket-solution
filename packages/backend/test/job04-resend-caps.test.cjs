/**
 * JOB-04 — Staff notification retry (resend) cooldown/user-limit/recipient-cap
 * dedup, plus retry(transient) vs terminal(DEAD) effect on emailNeedsCsCount.
 * DB isolation: Docker Postgres 18.1.
 *
 * Tenant-wide resend cap is a separate, not-yet-contracted AC branch (see
 * .artifacts/job04-report.md) and is intentionally not exercised here.
 */
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
  grantMembership,
  grantEventAssignment,
  retryNotificationDelivery,
  readEventReport,
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} = require('../dist');

const TASK_LABEL = 'task_115106d34dee';

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-job04-resend-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=' + TASK_LABEL,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=job04_resend_test',
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
        'job04_resend_test',
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
      '/job04_resend_test',
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
    for (const file of migrationFiles()) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      "ALTER DATABASE job04_resend_test SET app.tenant_id TO ''",
    );
  } finally {
    await admin.end().catch(() => {});
  }
  const url =
    'postgresql://postgres:' +
    password +
    '@127.0.0.1:' +
    port +
    '/job04_resend_test';
  return { name, url };
}

async function insertNotification(tx, tenantId, eventId, email) {
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO notifications (
      tenant_id, event_id, id, business_key, channel, kind, state,
      attempts, payload, created_at, updated_at
    ) VALUES (
      ${tenantId}::uuid, ${eventId}::uuid, ${id}::uuid,
      ${'ticket:' + randomUUID() + ':issued:email'}, 'email', 'TicketIssued',
      'FAILED', 1,
      ${JSON.stringify({ email, ownerUserId: randomUUID() })}::jsonb,
      now() - interval '2 minutes', now() - interval '2 minutes'
    )
  `;
  return id;
}

async function backdateNotification(tx, tenantId, notificationId) {
  await tx.$executeRaw`
    UPDATE notifications
    SET updated_at = clock_timestamp() - interval '2 minutes'
    WHERE tenant_id = ${tenantId}::uuid AND id = ${notificationId}::uuid
  `;
}

test(
  '[JOB-04] D staff resend: cooldown, staff hourly cap, recipient hourly cap, retry(transient)!=terminal for emailNeedsCs',
  { timeout: 180000 },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 4);

      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'https://auth.example.test/realms/job04';
      const staff1 = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'job04-staff-1',
        email: 'staff1-job04@example.test',
        emailVerified: true,
      });
      const staff2 = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'job04-staff-2',
        email: 'staff2-job04@example.test',
        emailVerified: true,
      });

      const tenantId = randomUUID();
      const eventId = randomUUID();

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'job04-tenant', name: 'JOB-04 Tenant' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'job04-event',
            name: 'JOB-04 Event',
            status: 'PUBLISHED',
          },
        });
        for (const staff of [staff1, staff2]) {
          const membership = await grantMembership(tx, {
            tenantId,
            userId: staff.userId,
            role: 'MANAGER',
            permissions: ['event.config', 'report.read'],
          });
          await grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: membership.membershipId,
            permissions: ['event.config', 'report.read'],
          });
        }
      });

      // --- Part A: cooldown — second retry within 60s on the same
      // notification is denied without mutating its state. ---
      let cooldownNotificationId;
      await withTenant(db, tenantId, async (tx) => {
        cooldownNotificationId = await insertNotification(
          tx,
          tenantId,
          eventId,
          'cooldown-recipient@example.test',
        );
        await retryNotificationDelivery(tx, {
          tenantId,
          eventId,
          notificationId: cooldownNotificationId,
          actorUserId: staff1.userId,
          reason: 'JOB-04 cooldown setup',
        });
        const before = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid AND id = ${cooldownNotificationId}::uuid
        `;
        assert.equal(before[0].state, 'PENDING');

        await assert.rejects(
          () =>
            retryNotificationDelivery(tx, {
              tenantId,
              eventId,
              notificationId: cooldownNotificationId,
              actorUserId: staff1.userId,
              reason: 'JOB-04 cooldown probe',
            }),
          (e) =>
            e instanceof NotificationError &&
            e.code === NOTIFICATION_ERROR_CODES.RESEND_COOLDOWN,
        );
        const after = await tx.$queryRaw`
          SELECT state, attempts FROM notifications
          WHERE tenant_id = ${tenantId}::uuid AND id = ${cooldownNotificationId}::uuid
        `;
        assert.equal(
          after[0].state,
          'PENDING',
          'cooldown-denied retry must not mutate notification state',
        );
      });

      // --- Part B: staff hourly cap (10/h). staff1 already consumed 1 slot
      // in Part A; 9 more distinct-recipient retries reach 10, the 11th
      // (still a distinct recipient, so recipient cap cannot be the cause)
      // must fail with the staff cap code. ---
      for (let i = 0; i < 9; i++) {
        await withTenant(db, tenantId, async (tx) => {
          const id = await insertNotification(
            tx,
            tenantId,
            eventId,
            `staff-cap-${i}@example.test`,
          );
          const result = await retryNotificationDelivery(tx, {
            tenantId,
            eventId,
            notificationId: id,
            actorUserId: staff1.userId,
            reason: 'JOB-04 staff cap fill ' + i,
          });
          assert.equal(result.requeued, true);
        });
      }
      await withTenant(db, tenantId, async (tx) => {
        const overflowId = await insertNotification(
          tx,
          tenantId,
          eventId,
          'staff-cap-overflow@example.test',
        );
        await assert.rejects(
          () =>
            retryNotificationDelivery(tx, {
              tenantId,
              eventId,
              notificationId: overflowId,
              actorUserId: staff1.userId,
              reason: 'JOB-04 staff cap overflow',
            }),
          (e) =>
            e instanceof NotificationError &&
            e.code === NOTIFICATION_ERROR_CODES.RESEND_LIMIT &&
            /staff/i.test(e.message),
        );
        const row = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid AND id = ${overflowId}::uuid
        `;
        assert.equal(
          row[0].state,
          'FAILED',
          'staff-cap-denied retry must not requeue the notification',
        );
      });

      // --- Part C: recipient hourly cap (3/h), isolated via staff2 (fresh
      // staff budget) and a single shared recipient email across 4
      // notifications; same clientless retries, no cooldown interference
      // because each call targets a different notification id. ---
      const sharedEmail = 'recipient-cap@example.test';
      for (let i = 0; i < 3; i++) {
        await withTenant(db, tenantId, async (tx) => {
          const id = await insertNotification(
            tx,
            tenantId,
            eventId,
            sharedEmail,
          );
          const result = await retryNotificationDelivery(tx, {
            tenantId,
            eventId,
            notificationId: id,
            actorUserId: staff2.userId,
            reason: 'JOB-04 recipient cap fill ' + i,
          });
          assert.equal(result.requeued, true);
        });
      }
      let recipientOverflowId;
      await withTenant(db, tenantId, async (tx) => {
        recipientOverflowId = await insertNotification(
          tx,
          tenantId,
          eventId,
          sharedEmail,
        );
        await assert.rejects(
          () =>
            retryNotificationDelivery(tx, {
              tenantId,
              eventId,
              notificationId: recipientOverflowId,
              actorUserId: staff2.userId,
              reason: 'JOB-04 recipient cap overflow',
            }),
          (e) =>
            e instanceof NotificationError &&
            e.code === NOTIFICATION_ERROR_CODES.RESEND_LIMIT &&
            /recipient/i.test(e.message),
        );
      });

      // --- Part D: retry(transient) vs terminal(DEAD) must not conflate for
      // emailNeedsCsCount. The staff-cap-denied notification above is still
      // FAILED (transient, retryable) and must NOT count; a separate
      // notification driven to DEAD (final failure dictionary O12) must. ---
      let deadNotificationId;
      await withTenant(db, tenantId, async (tx) => {
        deadNotificationId = await insertNotification(
          tx,
          tenantId,
          eventId,
          'terminal-failure@example.test',
        );
        await tx.$executeRaw`
          UPDATE notifications
          SET state = 'DEAD', last_error = 'provider rejected recipient', next_attempt_at = NULL
          WHERE tenant_id = ${tenantId}::uuid AND id = ${deadNotificationId}::uuid
        `;
        const report = await readEventReport(tx, {
          tenantId,
          eventId,
          actorUserId: staff1.userId,
        });
        assert.equal(
          report.emailNeedsCsCount,
          1,
          'exactly the DEAD terminal-failure notification must count toward emailNeedsCs',
        );
      });
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);
