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
  createTicketType,
  createIssuanceSource,
  listTicketTypes,
  listIssuanceSources,
  revokeMembership,
  EventAdminError,
  EVENT_ADMIN_ERROR_CODES,
  AuthzError,
  AUTHZ_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

async function startIsolatedPostgres() {
  const name = 'ticket-portal-cat-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_8cee52c4f852',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=portal_cat_test',
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
        'portal_cat_test',
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
      '/portal_cat_test',
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
      "CREATE ROLE portal_cat_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO portal_cat_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://portal_cat_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/portal_cat_test',
  };
}

test(
  'portal catalog G-T1: list ticket-types/sources isolation, cursor, mappings',
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

      const manager = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'cat-mgr',
        email: 'cat-mgr@example.com',
        emailVerified: true,
      });
      const outsider = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'cat-out',
        email: 'cat-out@example.com',
        emailVerified: true,
      });
      const otherMgr = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'cat-other',
        email: 'cat-other@example.com',
        emailVerified: true,
      });

      const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      let eventA;
      let eventB;
      let managerMembershipId;

      await withTenant(db, tenantA, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantA, slug: 'cat-a', name: 'Catalog A' },
        });
        const mem = await grantMembership(tx, {
          tenantId: tenantA,
          userId: manager.userId,
          role: 'OWNER',
          permissions: ['event.create', 'event.list'],
        });
        managerMembershipId = mem.membershipId;
        const ev = await createEvent(tx, {
          tenantId: tenantA,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'fest-a',
            name: 'Fest A',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        eventA = ev.event.eventId;

        const snapshots = [
          { access: 'ga', tier: 1 },
          { access: 'vip', nested: { seats: 2 } },
          ['should-not-leak'],
        ];
        const typeIds = [];
        for (let i = 0; i < 3; i++) {
          const tt = await createTicketType(tx, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: manager.userId,
            label: 'Type-' + i,
            entitlementSnapshot:
              i === 2 ? undefined : /** @type {any} */ (snapshots[i]),
          });
          typeIds.push(tt.ticketTypeId);
        }

        // Force a non-object snapshot in DB to verify controlled shape on read.
        await tx.$executeRaw`
          UPDATE ticket_types
          SET entitlement_snapshot = '["array-not-object"]'::jsonb
          WHERE tenant_id = ${tenantA}::uuid
            AND id = ${typeIds[2]}::uuid
        `;

        const src = await createIssuanceSource(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          name: 'Door',
          approvalMode: 'AUTO',
          ticketTypeId: typeIds[0],
        });
        // Second mapping — list must return all, not only the first.
        await tx.$executeRaw`
          INSERT INTO source_ticket_types (
            tenant_id, event_id, source_id, ticket_type_id
          ) VALUES (
            ${tenantA}::uuid, ${eventA}::uuid,
            ${src.sourceId}::uuid, ${typeIds[1]}::uuid
          )
        `;

        await createIssuanceSource(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          name: 'Online',
          approvalMode: 'MANUAL',
          ticketTypeId: typeIds[2],
        });

        const page1 = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          limit: 2,
        });
        assert.equal(page1.items.length, 2);
        assert.ok(page1.nextCursor);

        const page2 = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          cursor: page1.nextCursor,
          limit: 2,
        });
        assert.equal(page2.items.length, 1);
        assert.equal(page2.nextCursor, null);

        const defaultPage = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
        });
        assert.equal(defaultPage.items.length, 3);
        assert.equal(defaultPage.nextCursor, null);
        const byLabel = Object.fromEntries(
          defaultPage.items.map((i) => [i.label, i]),
        );
        assert.deepEqual(byLabel['Type-0'].entitlementSnapshot, {
          access: 'ga',
          tier: 1,
        });
        assert.deepEqual(byLabel['Type-1'].entitlementSnapshot, {
          access: 'vip',
          nested: { seats: 2 },
        });
        // Non-object jsonb coerced to controlled empty object.
        assert.deepEqual(byLabel['Type-2'].entitlementSnapshot, {});
        // Cursor pages partition the full set without dupes/loss.
        const pagedIds = [...page1.items, ...page2.items].map(
          (i) => i.ticketTypeId,
        );
        assert.deepEqual(
          [...pagedIds].sort(),
          defaultPage.items.map((i) => i.ticketTypeId).sort(),
        );

        const clamped = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          limit: 0,
        });
        assert.equal(clamped.items.length, 1);
        const capped = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          limit: 500,
        });
        assert.equal(capped.items.length, 3);

        await assert.rejects(
          () =>
            listTicketTypes(tx, {
              tenantId: tenantA,
              eventId: eventA,
              actorUserId: manager.userId,
              cursor: 'not-a-cursor',
            }),
          (err) =>
            err instanceof EventAdminError &&
            err.code === EVENT_ADMIN_ERROR_CODES.INVALID_CURSOR,
        );

        const sourcesPage1 = await listIssuanceSources(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          limit: 1,
        });
        assert.equal(sourcesPage1.items.length, 1);
        assert.ok(sourcesPage1.nextCursor);

        const sourcesPage2 = await listIssuanceSources(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          cursor: sourcesPage1.nextCursor,
        });
        assert.equal(sourcesPage2.items.length, 1);
        assert.equal(sourcesPage2.nextCursor, null);

        const allSources = await listIssuanceSources(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
        });
        assert.equal(allSources.items.length, 2);
        const door = allSources.items.find((s) => s.name === 'Door');
        const online = allSources.items.find((s) => s.name === 'Online');
        assert.ok(door);
        assert.ok(online);
        assert.equal(door.approvalMode, 'AUTO');
        assert.equal(online.approvalMode, 'MANUAL');
        assert.deepEqual(
          [...door.ticketTypeIds].sort(),
          [typeIds[0], typeIds[1]].sort(),
        );
        assert.equal(door.ticketTypeIds.length, 2);
        assert.deepEqual(online.ticketTypeIds, [typeIds[2]]);
        assert.deepEqual(
          [...sourcesPage1.items, ...sourcesPage2.items]
            .map((s) => s.sourceId)
            .sort(),
          allSources.items.map((s) => s.sourceId).sort(),
        );

        // Missing event → deny (no assignment), not a cross-tenant leak.
        await assert.rejects(
          () =>
            listTicketTypes(tx, {
              tenantId: tenantA,
              eventId: randomUUID(),
              actorUserId: manager.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
        );

        // No membership / permission.
        await assert.rejects(
          () =>
            listIssuanceSources(tx, {
              tenantId: tenantA,
              eventId: eventA,
              actorUserId: outsider.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
        );
      });

      // Cross-tenant: types in B must not appear when listing A; B manager
      // cannot read A catalogs.
      await withTenant(db, tenantB, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantB, slug: 'cat-b', name: 'Catalog B' },
        });
        await grantMembership(tx, {
          tenantId: tenantB,
          userId: otherMgr.userId,
          role: 'OWNER',
          permissions: ['event.create', 'event.list'],
        });
        const ev = await createEvent(tx, {
          tenantId: tenantB,
          actorUserId: otherMgr.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'fest-b',
            name: 'Fest B',
            timezone: 'UTC',
            visibility: 'UNLISTED',
          },
        });
        eventB = ev.event.eventId;
        await createTicketType(tx, {
          tenantId: tenantB,
          eventId: eventB,
          actorUserId: otherMgr.userId,
          label: 'Secret-B',
          entitlementSnapshot: { secret: true },
        });
      });

      await withTenant(db, tenantA, async (tx) => {
        const listed = await listTicketTypes(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
        });
        assert.equal(listed.items.length, 3);
        assert.ok(!listed.items.some((i) => i.label === 'Secret-B'));

        await assert.rejects(
          () =>
            listTicketTypes(tx, {
              tenantId: tenantA,
              eventId: eventB,
              actorUserId: manager.userId,
            }),
          (err) => err instanceof AuthzError,
        );
      });

      await withTenant(db, tenantB, async (tx) => {
        await assert.rejects(
          () =>
            listTicketTypes(tx, {
              tenantId: tenantB,
              eventId: eventA,
              actorUserId: otherMgr.userId,
            }),
          (err) => err instanceof AuthzError,
        );
      });

      // Revoked membership cannot list.
      await withTenant(db, tenantA, async (tx) => {
        await revokeMembership(tx, tenantA, managerMembershipId);
        await assert.rejects(
          () =>
            listTicketTypes(tx, {
              tenantId: tenantA,
              eventId: eventA,
              actorUserId: manager.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REVOKED,
        );
      });

      // Re-grant for permission-without-config check on a fresh membership.
      await withTenant(db, tenantA, async (tx) => {
        const mem = await grantMembership(tx, {
          tenantId: tenantA,
          userId: outsider.userId,
          role: 'CS',
          permissions: ['cs.lookup'],
        });
        await grantEventAssignment(tx, {
          tenantId: tenantA,
          eventId: eventA,
          membershipId: mem.membershipId,
          permissions: ['cs.lookup'],
        });
        await assert.rejects(
          () =>
            listIssuanceSources(tx, {
              tenantId: tenantA,
              eventId: eventA,
              actorUserId: outsider.userId,
            }),
          (err) =>
            err instanceof AuthzError &&
            err.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        );
      });
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
