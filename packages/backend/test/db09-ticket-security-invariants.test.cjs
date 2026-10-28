const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  grantMembership,
  grantEventAssignment,
  revokeTicket,
  openStaffSession,
  reserveCheckin,
  confirmCheckin,
  undoCheckin,
  unwrapReserveOutcome,
  cancelEvent,
  decideRedemption,
  readCodeHmacEnvironment,
  IssueError,
  ISSUE_ERROR_CODES,
  ApprovalError,
  APPROVAL_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd09-security-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'd09-security-test-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-db09-security-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '--label', 'ticket.task=task_277692627537',
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=d09_security_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'd09_security_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d09_security_test',
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
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d09_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d09_login');
    return {
      name,
      url: 'postgresql://d09_login:' + password + '@127.0.0.1:' + port + '/d09_security_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

const BACKEND_SRC = path.join(__dirname, '..', 'src');
const API_SRC = path.join(__dirname, '..', '..', '..', 'apps', 'api', 'src');

/**
 * Static regression guard: no business-logic module may ever write
 * owner_user_id outside the original issuance INSERT. A future PATCH-style
 * "update ticket" helper that touches this column would flip this to fail
 * before it could ship.
 */
function assertNoOwnerReassignmentStatement() {
  const offenders = [];
  for (const entry of readdirSync(BACKEND_SRC)) {
    if (!entry.endsWith('.ts') || entry === 'generated') continue;
    const full = path.join(BACKEND_SRC, entry);
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    // Any `UPDATE ... SET ... owner_user_id` within a reasonable window.
    if (/UPDATE\s+tickets[\s\S]{0,400}?SET[\s\S]{0,200}?owner_user_id/i.test(text)) {
      offenders.push(entry);
    }
  }
  return offenders;
}

/**
 * Static regression guard: no ticket-facing route may be a generic PATCH.
 * Resend/revoke/cancel/clone/publish must stay dedicated, audited endpoints
 * (TECHNICAL-DESIGN.md §10).
 */
function findTicketPatchRoutes() {
  const offenders = [];
  let entries;
  try {
    entries = readdirSync(API_SRC);
  } catch {
    return offenders;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.ts')) continue;
    const full = path.join(API_SRC, entry);
    const text = readFileSync(full, 'utf8');
    const patchCalls = text.matchAll(/@Patch\(\s*['"]([^'"]*)['"]\s*\)/g);
    for (const m of patchCalls) {
      if (/ticket/i.test(m[1])) offenders.push(entry + ' -> ' + m[1]);
    }
  }
  return offenders;
}

async function ticketRow(db, tenantId, ticketId) {
  return withTenant(db, tenantId, async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT owner_user_id, state FROM tickets
      WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketId}::uuid
    `;
    return rows[0];
  });
}

test(
  'DB-09: revoke never reuses a redemption code; no path reassigns ticket owner; allocation is gated on the current event policy, not a stale snapshot',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const alice = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'alice-d09',
        email: 'alice-d09@example.com',
        emailVerified: true,
      });
      const bob = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'bob-d09',
        email: 'bob-d09@example.com',
        emailVerified: true,
      });
      const carol = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'carol-d09',
        email: 'carol-d09@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'staff-d09',
        email: 'staff-d09@example.com',
        emailVerified: true,
      });

      const T1 = 'd0900000-0000-4000-8000-000000000001';
      const T2 = 'd0900000-0000-4000-8000-000000000002';
      const E1 = 'd0900000-0000-4000-8000-0000000000e1'; // revoke/reuse + owner-transfer
      const E2 = 'd0900000-0000-4000-8000-0000000000e2'; // AUTO allocation vs cancelled event
      const E3 = 'd0900000-0000-4000-8000-0000000000e3'; // MANUAL approve vs cancelled event
      const E4 = 'd0900000-0000-4000-8000-0000000000e4'; // second tenant, cross-tenant isolation

      const STAFF_PERMS = [
        'ticket.revoke',
        'gate.confirm',
        'gate.undo',
        'event.update',
        'redemption.approve',
      ];

      await withTenant(db, T1, async (tx) => {
        await tx.tenant.create({ data: { id: T1, slug: 'db09-t1', name: 'DB09 T1' } });
        for (const id of [E1, E2, E3]) {
          await tx.event.create({
            data: { tenantId: T1, id, slug: 'db09-' + id.slice(-2), name: 'Event ' + id, status: 'PUBLISHED' },
          });
        }
        const membership = await grantMembership(tx, {
          tenantId: T1,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: STAFF_PERMS,
        });
        for (const eventId of [E1, E2, E3]) {
          await grantEventAssignment(tx, {
            tenantId: T1,
            eventId,
            membershipId: membership.membershipId,
            permissions: STAFF_PERMS,
          });
        }
      });
      await withTenant(db, T2, async (tx) => {
        await tx.tenant.create({ data: { id: T2, slug: 'db09-t2', name: 'DB09 T2' } });
        await tx.event.create({
          data: { tenantId: T2, id: E4, slug: 'db09-e4', name: 'Event E4', status: 'PUBLISHED' },
        });
      });

      // =====================================================================
      // Part A: revoke never reuses the redemption code (and the two tenants
      // using the identical raw code string stay fully independent).
      // =====================================================================
      const invA = await withTenant(db, T1, (tx) =>
        seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E1,
          eventQuota: 2,
          rawCodes: ['DB09-SHARED-CODE'],
        }),
      );
      const invA2 = await withTenant(db, T2, (tx) =>
        seedEventInventory(tx, HMAC, {
          tenantId: T2,
          eventId: E4,
          eventQuota: 1,
          rawCodes: ['DB09-SHARED-CODE'],
        }),
      );

      const issuedA = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'DB09-SHARED-CODE',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(issuedA.ok, true);
      assert.equal(issuedA.result.state, 'ACTIVE');

      const issuedCarol = await withTenant(db, T2, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T2,
          eventId: E4,
          actorUserId: carol.userId,
          actorEmail: carol.email,
          emailVerified: true,
          rawCode: 'DB09-SHARED-CODE',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(issuedCarol.ok, true, 'same raw code string in a different tenant is an independent code');

      const beforeRevoke = await withTenant(db, T1, (tx) =>
        tx.$queryRaw`
          SELECT status, active_request_id FROM redemption_codes
          WHERE tenant_id = ${T1}::uuid AND id = ${invA.codeIds[0]}::uuid
        `,
      );
      assert.equal(beforeRevoke[0].status, 'CONSUMED');
      assert.equal(beforeRevoke[0].active_request_id, issuedA.result.requestId);

      await withTenant(db, T1, (tx) =>
        revokeTicket(tx, {
          tenantId: T1,
          eventId: E1,
          ticketId: issuedA.result.ticketId,
          actorUserId: staff.userId,
          reason: 'DB-09 revoke-no-reuse proof',
        }),
      );

      const afterRevoke = await withTenant(db, T1, async (tx) => {
        const ticket = await tx.$queryRaw`
          SELECT state, owner_user_id FROM tickets WHERE id = ${issuedA.result.ticketId}::uuid
        `;
        const cred = await tx.$queryRaw`
          SELECT status FROM ticket_credentials WHERE ticket_id = ${issuedA.result.ticketId}::uuid
        `;
        const code = await tx.$queryRaw`
          SELECT status, active_request_id FROM redemption_codes
          WHERE tenant_id = ${T1}::uuid AND id = ${invA.codeIds[0]}::uuid
        `;
        return { ticket: ticket[0], cred: cred[0], code: code[0] };
      });
      assert.equal(afterRevoke.ticket.state, 'REVOKED');
      // Revoke invalidates the ticket's current credential (old QR stops
      // scanning). This is NOT credential rotation: no new version is
      // minted, there is no "reissue" path in this codebase today (see
      // .artifacts/db09-local.md).
      assert.equal(afterRevoke.cred.status, 'REVOKED');
      // The code must stay exactly as it was at issuance: still CONSUMED,
      // still pointing at the original request. Revoke never frees it.
      assert.equal(afterRevoke.code.status, 'CONSUMED');
      assert.equal(afterRevoke.code.active_request_id, issuedA.result.requestId);

      const replayByOther = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: bob.userId,
          actorEmail: bob.email,
          emailVerified: true,
          rawCode: 'DB09-SHARED-CODE',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(replayByOther.ok, false);
      assert.equal(replayByOther.rejection.code, ISSUE_ERROR_CODES.CODE_CONSUMED);

      const replayByOriginal = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'DB09-SHARED-CODE',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(replayByOriginal.ok, false);
      assert.equal(replayByOriginal.rejection.code, ISSUE_ERROR_CODES.CODE_CONSUMED);

      const ticketCountE1 = await withTenant(db, T1, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM tickets WHERE event_id = ${E1}::uuid`,
      );
      assert.equal(ticketCountE1[0].n, 1, 'revoke + two replays must never produce a second ticket');

      const carolTicketStill = await ticketRow(db, T2, issuedCarol.result.ticketId);
      assert.equal(carolTicketStill.state, 'ACTIVE', 'T1 revoke must not leak into T2');

      // =====================================================================
      // Part B: no mutation path reassigns ticket ownership, even when every
      // mutating call is made by an actor who is *not* the owner.
      // =====================================================================
      const codeB = invA.codeIds[0]; // consumed; seed a fresh one instead
      const invB = await withTenant(db, T1, (tx) =>
        seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E1,
          eventQuota: 5,
          rawCodes: ['DB09-OWNER-CODE'],
        }),
      );
      void codeB;
      const issuedB = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'DB09-OWNER-CODE',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(issuedB.ok, true);
      const ticketIdB = issuedB.result.ticketId;

      const r0 = await ticketRow(db, T1, ticketIdB);
      assert.equal(r0.owner_user_id, alice.userId);

      const session = await withTenant(db, T1, (tx) =>
        openStaffSession(tx, { tenantId: T1, eventId: E1, userId: staff.userId }),
      );
      const hold = unwrapReserveOutcome(
        await withTenant(db, T1, (tx) =>
          reserveCheckin(tx, {
            tenantId: T1,
            eventId: E1,
            ticketId: ticketIdB,
            staffSessionId: session.sessionId,
            actorUserId: staff.userId,
          }),
        ),
      );
      const r1 = await ticketRow(db, T1, ticketIdB);
      assert.equal(r1.owner_user_id, alice.userId, 'reserve by staff must not touch owner');

      const confirmed = await withTenant(db, T1, (tx) =>
        confirmCheckin(tx, {
          tenantId: T1,
          eventId: E1,
          reservationId: hold.reservationId,
          token: hold.token,
          staffSessionId: session.sessionId,
          actorUserId: staff.userId,
        }),
      );
      assert.equal(confirmed.ok, true);
      const r2 = await ticketRow(db, T1, ticketIdB);
      assert.equal(r2.owner_user_id, alice.userId, 'confirm by staff must not touch owner');

      const undone = await withTenant(db, T1, (tx) =>
        undoCheckin(tx, {
          tenantId: T1,
          eventId: E1,
          checkinId: confirmed.checkinId,
          actorUserId: staff.userId,
          reason: 'DB-09 owner-immutability proof',
        }),
      );
      assert.equal(undone.state, 'ACTIVE');
      const r3 = await ticketRow(db, T1, ticketIdB);
      assert.equal(r3.owner_user_id, alice.userId, 'undo by staff must not touch owner');

      await withTenant(db, T1, (tx) =>
        revokeTicket(tx, {
          tenantId: T1,
          eventId: E1,
          ticketId: ticketIdB,
          actorUserId: staff.userId,
          reason: 'DB-09 owner-immutability proof (revoke)',
        }),
      );
      const r4 = await ticketRow(db, T1, ticketIdB);
      assert.equal(r4.state, 'REVOKED');
      assert.equal(r4.owner_user_id, alice.userId, 'revoke by staff must not touch owner');

      // Static contract guards: the behavioral proof above holds *because*
      // no such write path exists in source, not by accident.
      const ownerWriteOffenders = assertNoOwnerReassignmentStatement();
      assert.deepEqual(ownerWriteOffenders, [], 'no file may UPDATE tickets SET ... owner_user_id');
      const ticketPatchOffenders = findTicketPatchRoutes();
      assert.deepEqual(ticketPatchOffenders, [], 'no @Patch route may target a ticket resource');

      // =====================================================================
      // Part C: allocation is gated on the event policy verified *at
      // allocation time*, not the policy snapshot read when the request or
      // hold was first created.
      // =====================================================================
      const invC = await withTenant(db, T1, (tx) =>
        seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E2,
          eventQuota: 1,
          rawCodes: ['DB09-ALLOC-AUTO'],
        }),
      );
      await withTenant(db, T1, (tx) =>
        cancelEvent(tx, {
          tenantId: T1,
          eventId: E2,
          actorUserId: staff.userId,
          idempotencyKey: randomUUID(),
          body: { expectedRevision: 1, reason: 'DB-09 policy-at-allocation proof', notifyAttendees: false },
        }),
      );
      const blockedAuto = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E2,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'DB09-ALLOC-AUTO',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(blockedAuto.ok, false);
      assert.equal(blockedAuto.rejection.code, ISSUE_ERROR_CODES.EVENT_CANCELLED);
      const afterBlockedAuto = await withTenant(db, T1, async (tx) => {
        const quota = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${T1}::uuid AND event_id = ${E2}::uuid AND scope = 'EVENT'
        `;
        const code = await tx.$queryRaw`
          SELECT status FROM redemption_codes WHERE id = ${invC.codeIds[0]}::uuid
        `;
        const tickets = await tx.$queryRaw`
          SELECT count(*)::int AS n FROM tickets WHERE event_id = ${E2}::uuid
        `;
        return { allocated: Number(quota[0].allocated), code: code[0].status, tickets: tickets[0].n };
      });
      assert.equal(afterBlockedAuto.allocated, 0);
      assert.equal(afterBlockedAuto.code, 'AVAILABLE');
      assert.equal(afterBlockedAuto.tickets, 0);

      const invD = await withTenant(db, T1, async (tx) => {
        const seeded = await seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E3,
          eventQuota: 1,
          rawCodes: ['DB09-ALLOC-MANUAL'],
        });
        await tx.$executeRaw`
          UPDATE issuance_sources
          SET approval_mode = 'MANUAL', updated_at = now()
          WHERE tenant_id = ${T1}::uuid AND id = ${seeded.sourceId}::uuid
        `;
        return seeded;
      });
      const pending = await withTenant(db, T1, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E3,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'DB09-ALLOC-MANUAL',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(pending.ok, 'pending');
      assert.equal(pending.result.status, 'PENDING_REVIEW');

      // Event was open when the hold was created; cancel it afterwards.
      await withTenant(db, T1, (tx) =>
        cancelEvent(tx, {
          tenantId: T1,
          eventId: E3,
          actorUserId: staff.userId,
          idempotencyKey: randomUUID(),
          body: { expectedRevision: 1, reason: 'DB-09 policy-at-approval proof', notifyAttendees: false },
        }),
      );

      const blockedApprove = await withTenant(db, T1, (tx) =>
        decideRedemption(tx, CRED_KEY, {
          tenantId: T1,
          eventId: E3,
          requestId: pending.result.requestId,
          actorUserId: staff.userId,
          decision: 'approve',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(blockedApprove.ok, false, 'approve must re-check the CURRENT event policy, not the one at hold time');
      assert.equal(blockedApprove.rejection.code, APPROVAL_ERROR_CODES.EVENT_CANCELLED);

      const afterBlockedApprove = await withTenant(db, T1, async (tx) => {
        const quota = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${T1}::uuid AND event_id = ${E3}::uuid AND scope = 'EVENT'
        `;
        const code = await tx.$queryRaw`
          SELECT status, active_request_id FROM redemption_codes WHERE id = ${invD.codeIds[0]}::uuid
        `;
        const tickets = await tx.$queryRaw`
          SELECT count(*)::int AS n FROM tickets WHERE event_id = ${E3}::uuid
        `;
        return { allocated: Number(quota[0].allocated), code: code[0], tickets: tickets[0].n };
      });
      assert.equal(afterBlockedApprove.allocated, 0, 'approve-after-cancel must not allocate quota');
      assert.equal(afterBlockedApprove.code.status, 'HELD', 'code must stay HELD, never silently consumed');
      assert.equal(afterBlockedApprove.code.active_request_id, pending.result.requestId);
      assert.equal(afterBlockedApprove.tickets, 0, 'no ticket may be created once the current policy rejects allocation');
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
