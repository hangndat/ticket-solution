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
  createEvent,
  seedEventInventory,
  readCodeHmacEnvironment,
  listEventAudit,
  listEventCodes,
  listPlatformAudit,
  bootstrapPlatformOperator,
  provisionTenant,
  readPlatformSecurityConfig,
  ReportError,
  REPORT_ERROR_CODES,
  InventoryError,
  INVENTORY_ERROR_CODES,
  AuthzError,
  AUTHZ_ERROR_CODES,
  PlatformError,
  PLATFORM_ERROR_CODES,
  O06_AUDIT_TTL_DAYS,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'e406-audit-codes-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startIsolatedPostgres() {
  const name = 'ticket-portal-audit-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_276b57bfcb52',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=portal_audit_test',
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
        'portal_audit_test',
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
      '/portal_audit_test',
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
      "CREATE ROLE portal_audit_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO portal_audit_login');
    await admin.query('GRANT ticket_platform_runtime TO portal_audit_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://portal_audit_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/portal_audit_test',
  };
}

function assertNoForbidden(obj, keys) {
  const rec = obj;
  for (const key of keys) {
    assert.equal(Object.prototype.hasOwnProperty.call(rec, key), false, key);
  }
  const blob = JSON.stringify(obj);
  assert.equal(blob.includes('code_hmac'), false);
  assert.equal(blob.includes('sanitizedDiff'), false);
  assert.equal(blob.includes('sanitized_diff'), false);
}

test(
  'H-A1/H-C1/H-P-AUDIT: masked audit+codes+platform; O06 TTL; authz',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });

      const manager = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'audit-mgr',
        email: 'audit-mgr@example.com',
        emailVerified: true,
      });
      const scanner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'audit-scan',
        email: 'audit-scan@example.com',
        emailVerified: true,
      });
      const operator = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'audit-op',
        email: 'audit-op@example.com',
        emailVerified: true,
      });

      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      let eventId;
      let sourceId;
      let ticketTypeId;
      const rawCodes = ['CODE-ALPHA-001', 'CODE-BETA-002', 'CODE-GAMMA-003'];

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'audit-a', name: 'Audit A' },
        });
        await grantMembership(tx, {
          tenantId,
          userId: manager.userId,
          role: 'MANAGER',
          permissions: ['event.create'],
        });

        const ev = await createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'audit-fest',
            name: 'Audit Fest',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        eventId = ev.event.eventId;

        const scanMem = await grantMembership(tx, {
          tenantId,
          userId: scanner.userId,
          role: 'SCANNER',
          permissions: ['gate.confirm'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          membershipId: scanMem.membershipId,
          eventId,
          permissions: ['gate.confirm'],
        });

        const seeded = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes,
        });
        sourceId = seeded.sourceId;
        ticketTypeId = seeded.ticketTypeId;

        // Three audit rows (newest last insert wins created_at order).
        for (let i = 0; i < 3; i++) {
          await tx.$executeRaw`
            INSERT INTO audit_logs (
              tenant_id, event_id, id, actor_user_id, action,
              resource_type, resource_id, reason, sanitized_diff, operation_id
            ) VALUES (
              ${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid,
              ${manager.userId}::uuid, ${'demo.action.' + i},
              'event', ${eventId}::uuid,
              ${'secret-reason-' + i},
              ${JSON.stringify({ email: 'leak@example.com', hmac: 'deadbeef' })}::jsonb,
              ${randomUUID()}::uuid
            )
          `;
        }

        // Stale row beyond O06 TTL must not appear.
        await tx.$executeRaw`
          INSERT INTO audit_logs (
            tenant_id, event_id, id, actor_user_id, action,
            resource_type, resource_id, reason, sanitized_diff, created_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid,
            ${manager.userId}::uuid, 'demo.ancient',
            'event', ${eventId}::uuid,
            'ancient', '{}'::jsonb,
            clock_timestamp() - make_interval(days => ${O06_AUDIT_TTL_DAYS + 1})
          )
        `;

        const page1 = await listEventAudit(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          limit: 2,
        });
        assert.equal(page1.items.length, 2);
        assert.ok(page1.nextCursor);
        for (const item of page1.items) {
          assertNoForbidden(item, [
            'reason',
            'sanitizedDiff',
            'code_hmac',
            'email',
          ]);
          assert.ok(item.auditId);
          assert.ok(item.action);
          assert.ok(item.createdAt);
        }
        assert.equal(
          page1.items.some((i) => i.action === 'demo.ancient'),
          false,
        );

        const page2 = await listEventAudit(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          cursor: page1.nextCursor,
          limit: 2,
        });
        assert.ok(page2.items.length >= 1);
        const actions = new Set([
          ...page1.items.map((i) => i.action),
          ...page2.items.map((i) => i.action),
        ]);
        assert.equal(actions.has('demo.ancient'), false);

        await assert.rejects(
          () =>
            listEventAudit(tx, {
              tenantId,
              eventId,
              actorUserId: manager.userId,
              cursor: 'not-a-cursor',
            }),
          (err) =>
            err instanceof ReportError &&
            err.code === REPORT_ERROR_CODES.INVALID_CURSOR,
        );

        await assert.rejects(
          () =>
            listEventAudit(tx, {
              tenantId,
              eventId,
              actorUserId: scanner.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        );

        const codesPage = await listEventCodes(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          limit: 2,
        });
        assert.equal(codesPage.items.length, 2);
        assert.ok(codesPage.nextCursor);
        for (const item of codesPage.items) {
          assertNoForbidden(item, [
            'code_hmac',
            'codeHmac',
            'rawCode',
            'code',
            'q',
          ]);
          assert.equal(item.state, 'AVAILABLE');
          assert.equal(item.sourceId, sourceId);
          assert.equal(item.ticketTypeId, ticketTypeId);
        }

        const byQ = await listEventCodes(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          q: rawCodes[1],
        });
        assert.equal(byQ.items.length, 1);
        assertNoForbidden(byQ.items[0], ['q', 'code_hmac', 'rawCode']);
        const blob = JSON.stringify(byQ);
        assert.equal(blob.includes(rawCodes[1]), false);

        await assert.rejects(
          () =>
            listEventCodes(tx, HMAC, {
              tenantId,
              eventId,
              actorUserId: scanner.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        );

        await assert.rejects(
          () =>
            listEventCodes(tx, HMAC, {
              tenantId,
              eventId,
              actorUserId: manager.userId,
              state: 'NOPE',
            }),
          (err) =>
            err instanceof InventoryError &&
            err.code === INVENTORY_ERROR_CODES.INVALID_INPUT,
        );
      });

      // Platform audit via provision (writes platform_audit_logs).
      const provisioned = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: randomUUID(),
        body: {
          slug: 'plat-audit-' + randomBytes(2).toString('hex'),
          name: 'Platform Audit Tenant',
          ownerEmail: 'owner-plat-audit@example.com',
          limits: {
            maxEvents: 5,
            maxStaff: 5,
            emailPerDay: 100,
            importRowsPerJob: 1000,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });

      const platPage = await listPlatformAudit(db, {
        actorUserId: operator.userId,
        limit: 10,
      });
      assert.ok(platPage.items.length >= 1);
      for (const item of platPage.items) {
        assertNoForbidden(item, [
          'reason',
          'sanitizedDiff',
          'operationId',
          'code_hmac',
        ]);
        assert.ok(item.auditId);
        assert.ok(item.action);
        assert.ok('tenantId' in item);
      }
      assert.ok(
        platPage.items.some((i) => i.tenantId === provisioned.tenantId),
      );

      await assert.rejects(
        () =>
          listPlatformAudit(db, {
            actorUserId: manager.userId,
          }),
        (err) =>
          err instanceof PlatformError &&
          (err.code === PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED ||
            err.code === PLATFORM_ERROR_CODES.PERMISSION_DENIED),
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
