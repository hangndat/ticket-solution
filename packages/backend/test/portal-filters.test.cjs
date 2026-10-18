const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  holdCodeForReview,
  listStaffPendingRedemptions,
  listEventNotifications,
  createExportJob,
  listExportJobs,
  AuthzError,
  AUTHZ_ERROR_CODES,
  EXPORT_ERROR_CODES,
  ExportError,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'portal-filters-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startIsolatedPostgres() {
  const name = 'ticket-portal-filt-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_29c706383c57',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=portal_filt_test',
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
        'portal_filt_test',
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
      '/portal_filt_test',
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
      "CREATE ROLE portal_filt_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO portal_filt_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://portal_filt_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/portal_filt_test',
  };
}

test(
  'portal filters G-R1/G-N1/G-E1: pending/notify/export history',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';

      const staff = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'filt-staff',
        email: 'filt-staff@example.com',
        emailVerified: true,
      });
      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'filt-owner',
        email: 'filt-owner@example.com',
        emailVerified: true,
      });
      const outsider = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'filt-out',
        email: 'filt-out@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

      const setup = await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'filt', name: 'Filters' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'filt-evt',
            name: 'Filt Event',
            status: 'DRAFT',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: [
            'redemption.approve',
            'event.config',
            'export.create',
            'export.download',
          ],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: [
            'redemption.approve',
            'event.config',
            'export.create',
            'export.download',
          ],
        });

        const invA = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          sourceName: 'Source-A',
          ticketTypeLabel: 'Type-A',
          rawCodes: ['FILT-A1', 'FILT-A2'],
        });
        const invB = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          sourceName: 'Source-B',
          ticketTypeLabel: 'Type-B',
          rawCodes: ['FILT-B1'],
        });

        const holdA1 = await holdCodeForReview(tx, {
          tenantId,
          eventId,
          ownerUserId: owner.userId,
          codeId: invA.codeIds[0],
        });
        const holdA2 = await holdCodeForReview(tx, {
          tenantId,
          eventId,
          ownerUserId: owner.userId,
          codeId: invA.codeIds[1],
        });
        const holdB1 = await holdCodeForReview(tx, {
          tenantId,
          eventId,
          ownerUserId: owner.userId,
          codeId: invB.codeIds[0],
        });

        return { invA, invB, holdA1, holdA2, holdB1 };
      });

      // --- G-R1 pending filters ---
      const allPending = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(allPending.items.length, 3);
      assert.ok(
        allPending.items.every((i) => i.actorEmailMasked === 'f***@example.com'),
      );

      const bySource = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          sourceId: setup.invA.sourceId,
        }),
      );
      assert.equal(bySource.items.length, 2);
      assert.ok(
        bySource.items.every((i) => i.sourceId === setup.invA.sourceId),
      );

      const byType = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          ticketTypeId: setup.invB.ticketTypeId,
        }),
      );
      assert.equal(byType.items.length, 1);
      assert.equal(byType.items[0].requestId, setup.holdB1.requestId);

      const byQ = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          q: setup.holdA2.requestId,
        }),
      );
      assert.equal(byQ.items.length, 1);
      assert.equal(byQ.items[0].requestId, setup.holdA2.requestId);

      const emptyQ = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          q: randomUUID(),
        }),
      );
      assert.equal(emptyQ.items.length, 0);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            listStaffPendingRedemptions(tx, {
              tenantId,
              eventId,
              actorUserId: outsider.userId,
            }),
          ),
        (err) =>
          err instanceof AuthzError &&
          (err.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED ||
            err.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED),
      );

      // --- G-N1 notification filters ---
      const nEmailPending = '11111111-1111-4111-8111-111111111111';
      const nEmailFailed = '22222222-2222-4222-8222-222222222222';
      const nPushPending = '33333333-3333-4333-8333-333333333333';
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, state, kind,
            payload_version, attempts, payload, created_at, updated_at
          ) VALUES
            (
              ${tenantId}::uuid, ${eventId}::uuid, ${nEmailPending}::uuid,
              'filt:email:pending', 'email', 'PENDING', 'TicketIssued', 1,
              0, '{}'::jsonb, now(), now()
            ),
            (
              ${tenantId}::uuid, ${eventId}::uuid, ${nEmailFailed}::uuid,
              'filt:email:failed', 'email', 'FAILED', 'TicketIssued', 1,
              1, '{}'::jsonb, now(), now()
            ),
            (
              ${tenantId}::uuid, ${eventId}::uuid, ${nPushPending}::uuid,
              'filt:push:pending', 'push', 'PENDING', 'TicketIssued', 1,
              0, '{}'::jsonb, now(), now()
            )
        `;
      });

      const allNotes = await withTenant(db, tenantId, (tx) =>
        listEventNotifications(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(allNotes.items.length, 3);

      const failedOnly = await withTenant(db, tenantId, (tx) =>
        listEventNotifications(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          state: 'FAILED',
        }),
      );
      assert.equal(failedOnly.items.length, 1);
      assert.equal(failedOnly.items[0].notificationId, nEmailFailed);

      const pushOnly = await withTenant(db, tenantId, (tx) =>
        listEventNotifications(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          channel: 'push',
        }),
      );
      assert.equal(pushOnly.items.length, 1);
      assert.equal(pushOnly.items[0].notificationId, nPushPending);

      const pendingEmail = await withTenant(db, tenantId, (tx) =>
        listEventNotifications(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          state: 'PENDING',
          channel: 'email',
        }),
      );
      assert.equal(pendingEmail.items.length, 1);
      assert.equal(pendingEmail.items[0].notificationId, nEmailPending);

      // --- G-E1 export history ---
      const jobPending = await withTenant(db, tenantId, (tx) =>
        createExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          clientKey: 'filt-export-1',
          ttlSeconds: 3600,
        }),
      );
      const jobReady = await withTenant(db, tenantId, (tx) =>
        createExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          clientKey: 'filt-export-2',
          ttlSeconds: 3600,
        }),
      );
      const jobFailed = await withTenant(db, tenantId, (tx) =>
        createExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          clientKey: 'filt-export-3',
          ttlSeconds: 3600,
        }),
      );
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE exports
          SET status = 'READY', row_count = 1, updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${jobReady.exportId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE exports
          SET status = 'FAILED', error_code = 'EXPORT_FAILED', updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${jobFailed.exportId}::uuid
        `;
      });

      const history = await withTenant(db, tenantId, (tx) =>
        listExportJobs(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(history.items.length, 3);
      for (const item of history.items) {
        assert.ok(item.createdAt);
        assert.equal('objectKey' in item, false);
        assert.equal('object_key' in item, false);
      }

      const readyOnly = await withTenant(db, tenantId, (tx) =>
        listExportJobs(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          status: 'READY',
        }),
      );
      assert.equal(readyOnly.items.length, 1);
      assert.equal(readyOnly.items[0].exportId, jobReady.exportId);
      assert.equal(readyOnly.items[0].status, 'READY');

      const page1 = await withTenant(db, tenantId, (tx) =>
        listExportJobs(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          limit: 2,
        }),
      );
      assert.equal(page1.items.length, 2);
      assert.ok(page1.nextCursor);
      const page2 = await withTenant(db, tenantId, (tx) =>
        listExportJobs(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          limit: 2,
          cursor: page1.nextCursor,
        }),
      );
      assert.equal(page2.items.length, 1);
      assert.equal(page2.nextCursor, null);
      const ids = new Set([
        ...page1.items.map((i) => i.exportId),
        ...page2.items.map((i) => i.exportId),
      ]);
      assert.equal(ids.size, 3);
      assert.ok(ids.has(jobPending.exportId));

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            listExportJobs(tx, {
              tenantId,
              eventId,
              actorUserId: staff.userId,
              cursor: 'not-a-cursor',
            }),
          ),
        (err) =>
          err instanceof ExportError &&
          err.code === EXPORT_ERROR_CODES.INVALID_CURSOR,
      );

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            listExportJobs(tx, {
              tenantId,
              eventId,
              actorUserId: outsider.userId,
            }),
          ),
        (err) => err instanceof AuthzError,
      );
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
