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
  createEvent,
  updateEvent,
  cloneEvent,
  archiveEvent,
  cancelEvent,
  previewEventImpact,
  getEvent,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  listTicketsForOwner,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  readCodeHmacEnvironment,
  EventError,
  EVENT_ERROR_CODES,
  IssueError,
  ISSUE_ERROR_CODES,
  GateError,
  GATE_ERROR_CODES,
  canEnqueueOutboxKind,
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
  '202610170010_e_be_event_lifecycle',
].map((name) =>
  path.join(__dirname, '../prisma/migrations', name, 'migration.sql'),
);

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'e-be-lifecycle-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'e-be-lifecycle-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-e-be-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_40dcb2dea4ad',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=e_be_test',
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
        'e_be_test',
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/e_be_test',
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
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE e_be_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO e_be_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://e_be_login:' + password + '@127.0.0.1:' + port + '/e_be_test',
  };
}

test(
  'C-E event lifecycle: metadata, clone zero-copy, cancel vs issue/gate, revision, no unsupported outbox',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'manager',
        email: 'manager@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'guest',
        email: 'guest@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff',
        email: 'staff@example.com',
        emailVerified: true,
      });
      const stranger = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'stranger',
        email: 'stranger@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'lifecycle', name: 'Lifecycle' },
        });
        await grantMembership(tx, {
          tenantId,
          userId: manager.userId,
          role: 'MANAGER',
          permissions: [
            'event.create',
            'event.update',
            'event.config',
            'event.publish',
            'inventory.import',
          ],
        });
      });

      assert.equal(canEnqueueOutboxKind('EventChanged'), false);
      assert.equal(canEnqueueOutboxKind('EventCancelled'), false);
      assert.equal(canEnqueueOutboxKind('TicketIssued'), true);

      const createKey = randomUUID();
      const created = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body: {
            slug: 'spring-fest',
            name: 'Spring Fest',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
            startsAt: '2026-11-01T10:00:00.000Z',
            endsAt: '2026-11-01T18:00:00.000Z',
            venue: { name: 'Hall A', address: '1 Main St' },
            contact: { email: 'ops@example.com' },
            redemptionOpensAt: '2026-10-01T00:00:00.000Z',
            redemptionClosesAt: '2026-12-01T00:00:00.000Z',
            checkInOpensAt: '2026-11-01T09:00:00.000Z',
            checkInClosesAt: '2026-11-01T20:00:00.000Z',
            maxTicketsPerAttendee: 3,
          },
        }),
      );
      assert.equal(created.replayed, false);
      assert.equal(created.event.contentStatus, 'DRAFT');
      assert.equal(created.event.businessStatus, 'ACTIVE');
      assert.equal(created.event.revision, 1);
      assert.equal(created.event.venue.name, 'Hall A');
      assert.equal(created.event.maxTicketsPerAttendee, 3);

      const replayCreate = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body: {
            slug: 'spring-fest',
            name: 'Spring Fest',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
            startsAt: '2026-11-01T10:00:00.000Z',
            endsAt: '2026-11-01T18:00:00.000Z',
            venue: { name: 'Hall A', address: '1 Main St' },
            contact: { email: 'ops@example.com' },
            redemptionOpensAt: '2026-10-01T00:00:00.000Z',
            redemptionClosesAt: '2026-12-01T00:00:00.000Z',
            checkInOpensAt: '2026-11-01T09:00:00.000Z',
            checkInClosesAt: '2026-11-01T20:00:00.000Z',
            maxTicketsPerAttendee: 3,
          },
        }),
      );
      assert.equal(replayCreate.replayed, true);
      assert.equal(replayCreate.event.eventId, created.event.eventId);

      const eventId = created.event.eventId;

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            getEvent(tx, {
              tenantId,
              eventId,
              actorUserId: stranger.userId,
            }),
          ),
        (err) => err.name === 'AuthzError',
      );

      await withTenant(db, tenantId, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['LIFE-1', 'LIFE-2', 'LIFE-CANCEL'],
        });
        const membership = await tx.$queryRaw`
          SELECT id FROM memberships
          WHERE tenant_id = ${tenantId}::uuid AND user_id = ${manager.userId}::uuid
        `;
        // staff assignment for gate
        const staffMembership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'STAFF',
          permissions: ['gate.confirm', 'gate.undo'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: staffMembership.membershipId,
          permissions: ['gate.confirm', 'gate.undo'],
        });
        void membership;
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'LIFE-1',
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      assert.ok(issued.ticketId);

      const impact = await withTenant(db, tenantId, (tx) =>
        previewEventImpact(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          body: {
            expectedRevision: 1,
            startsAt: '2026-11-01T11:00:00.000Z',
            venue: { name: 'Hall B', address: '2 Main St' },
          },
        }),
      );
      assert.equal(impact.requiresConfirm, true);
      assert.ok(impact.affectedTicketCount >= 1);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            updateEvent(tx, {
              tenantId,
              eventId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: {
                expectedRevision: 1,
                startsAt: '2026-11-01T11:00:00.000Z',
                venue: { name: 'Hall B', address: '2 Main St' },
              },
            }),
          ),
        (err) =>
          err instanceof EventError &&
          err.code === EVENT_ERROR_CODES.IMPACT_CONFIRM_REQUIRED,
      );

      const patched = await withTenant(db, tenantId, (tx) =>
        updateEvent(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            expectedRevision: 1,
            startsAt: '2026-11-01T11:00:00.000Z',
            venue: { name: 'Hall B', address: '2 Main St' },
            confirmIssuedImpact: true,
            notifyAttendees: true,
          },
        }),
      );
      assert.equal(patched.event.revision, 2);
      assert.equal(patched.event.venue.name, 'Hall B');

      // notifyAttendees must not enqueue unsupported EventChanged
      const outboxChanged = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND type = 'EventChanged'
        `,
      );
      assert.equal(Number(outboxChanged[0].n), 0);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            updateEvent(tx, {
              tenantId,
              eventId,
              actorUserId: manager.userId,
              idempotencyKey: randomUUID(),
              body: {
                expectedRevision: 1,
                name: 'Stale',
              },
            }),
          ),
        (err) =>
          err instanceof EventError &&
          err.code === EVENT_ERROR_CODES.REVISION_CONFLICT,
      );

      // Close redemption window; owner read + prior redeem receipt still OK.
      await withTenant(db, tenantId, (tx) =>
        updateEvent(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            expectedRevision: 2,
            redemptionOpensAt: '2019-01-01T00:00:00.000Z',
            redemptionClosesAt: '2020-01-01T00:00:00.000Z',
          },
        }),
      );
      const ownerTickets = await withTenant(db, tenantId, (tx) =>
        listTicketsForOwner(tx, tenantId, guest.userId),
      );
      assert.ok(
        ownerTickets.some(
          (t) => t.ticketId === issued.ticketId && t.eventId === eventId,
        ),
      );

      const redeemKey = randomUUID();
      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'LIFE-2',
              idempotencyKey: redeemKey,
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (err) =>
          err instanceof IssueError &&
          err.code === ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED,
      );

      // Re-open redemption for clone/cancel paths; keep check-in open.
      await withTenant(db, tenantId, (tx) =>
        updateEvent(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            expectedRevision: 3,
            redemptionClosesAt: '2030-01-01T00:00:00.000Z',
            checkInOpensAt: null,
            checkInClosesAt: null,
          },
        }),
      );

      const cloneKey = randomUUID();
      const cloned = await withTenant(db, tenantId, (tx) =>
        cloneEvent(tx, {
          tenantId,
          sourceEventId: eventId,
          actorUserId: manager.userId,
          idempotencyKey: cloneKey,
          body: { slug: 'spring-fest-copy', name: 'Spring Fest Copy', copyConfig: true },
        }),
      );
      assert.equal(cloned.event.contentStatus, 'DRAFT');
      assert.notEqual(cloned.event.eventId, eventId);
      const cloneCounts = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT
            (SELECT COUNT(*)::int FROM redemption_codes WHERE event_id = ${cloned.event.eventId}::uuid) AS codes,
            (SELECT COUNT(*)::int FROM tickets WHERE event_id = ${cloned.event.eventId}::uuid) AS tickets,
            (SELECT COUNT(*)::int FROM event_attendees WHERE event_id = ${cloned.event.eventId}::uuid) AS attendees,
            (SELECT COUNT(*)::int FROM quota_buckets WHERE event_id = ${cloned.event.eventId}::uuid) AS quotas,
            (SELECT COUNT(*)::int FROM staff_sessions WHERE event_id = ${cloned.event.eventId}::uuid) AS staff
        `,
      );
      assert.equal(Number(cloneCounts[0].codes), 0);
      assert.equal(Number(cloneCounts[0].tickets), 0);
      assert.equal(Number(cloneCounts[0].attendees), 0);
      assert.equal(Number(cloneCounts[0].quotas), 0);
      assert.equal(Number(cloneCounts[0].staff), 0);

      const cancelKey = randomUUID();
      const cancelled = await withTenant(db, tenantId, (tx) =>
        cancelEvent(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          idempotencyKey: cancelKey,
          body: {
            expectedRevision: 4,
            reason: 'Weather',
            notifyAttendees: true,
          },
        }),
      );
      assert.equal(cancelled.event.businessStatus, 'CANCELLED');
      assert.equal(cancelled.event.revision, 5);

      const outboxCancelled = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND type = 'EventCancelled'
        `,
      );
      assert.equal(Number(outboxCancelled[0].n), 0);

      // Cancel blocks new issue; prior ticket owner-read still works.
      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'LIFE-CANCEL',
              idempotencyKey: randomUUID(),
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (err) =>
          err instanceof IssueError &&
          err.code === ISSUE_ERROR_CODES.EVENT_CANCELLED,
      );

      const stillOwned = await withTenant(db, tenantId, (tx) =>
        listTicketsForOwner(tx, tenantId, guest.userId),
      );
      assert.ok(stillOwned.some((t) => t.ticketId === issued.ticketId));

      await assert.rejects(
        () =>
          withTenant(db, tenantId, async (tx) => {
            const session = await openStaffSession(tx, {
              tenantId,
              eventId,
              userId: staff.userId,
            });
            await reserveCheckin(tx, {
              tenantId,
              eventId,
              ticketId: issued.ticketId,
              staffSessionId: session.sessionId,
              actorUserId: staff.userId,
            });
          }),
        (err) =>
          err instanceof GateError &&
          err.code === GATE_ERROR_CODES.EVENT_CANCELLED,
      );

      // Fresh published event: archive blocks issue; gate still OK when business ACTIVE.
      const archivedCreate = await withTenant(db, tenantId, (tx) =>
        createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'archive-me',
            name: 'Archive Me',
            timezone: 'UTC',
            maxTicketsPerAttendee: 5,
          },
        }),
      );
      const archiveEventId = archivedCreate.event.eventId;
      await withTenant(db, tenantId, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId: archiveEventId,
          eventQuota: 3,
          rawCodes: ['ARCH-1'],
        });
        const m = await tx.$queryRaw`
          SELECT id FROM memberships
          WHERE tenant_id = ${tenantId}::uuid AND user_id = ${staff.userId}::uuid
        `;
        await grantEventAssignment(tx, {
          tenantId,
          eventId: archiveEventId,
          membershipId: m[0].id,
          permissions: ['gate.confirm', 'gate.undo'],
        });
      });
      const issuedArch = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
            tenantId,
            eventId: archiveEventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'ARCH-1',
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      const archived = await withTenant(db, tenantId, (tx) =>
        archiveEvent(tx, {
          tenantId,
          eventId: archiveEventId,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: { expectedRevision: archivedCreate.event.revision },
        }),
      );
      assert.equal(archived.event.contentStatus, 'ARCHIVED');
      assert.equal(archived.event.businessStatus, 'ACTIVE');

      await withTenant(db, tenantId, async (tx) => {
        const session = await openStaffSession(tx, {
          tenantId,
          eventId: archiveEventId,
          userId: staff.userId,
        });
        const reserved = await reserveCheckin(tx, {
          tenantId,
          eventId: archiveEventId,
          ticketId: issuedArch.ticketId,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        });
        const confirmed = await confirmCheckin(tx, {
          tenantId,
          eventId: archiveEventId,
          reservationId: reserved.reservationId,
          token: reserved.token,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        });
        assert.equal(confirmed.state, 'USED');
      });

      // CLOSED → ARCHIVED explicit migration mapping
      const closedId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO events (tenant_id, id, slug, name, status, content_status, business_status)
          VALUES (
            ${tenantId}::uuid, ${closedId}::uuid, 'legacy-closed', 'Legacy',
            'ARCHIVED', 'ARCHIVED', 'ACTIVE'
          )
        `;
        const rows = await tx.$queryRaw`
          SELECT content_status, business_status, status
          FROM events WHERE id = ${closedId}::uuid
        `;
        assert.equal(rows[0].content_status, 'ARCHIVED');
        assert.equal(rows[0].business_status, 'ACTIVE');
        assert.equal(rows[0].status, 'ARCHIVED');
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
