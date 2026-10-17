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
  decideRedemption,
  redeemAndIssueTicket,
  AuthzError,
  AUTHZ_ERROR_CODES,
  APPROVAL_ERROR_CODES,
  APPROVAL_PENDING,
  ISSUE_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

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
  '202610170011_b_be_config_assets',
  '202610170012_f_be_form_consent',
].map((name) => path.join(__dirname, '../prisma/migrations', name, 'migration.sql'));

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd4-approval-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'd4-approval-credential-key';

async function startIsolatedPostgres() {
  const name = 'ticket-d4-appr-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=d4_appr_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'd4_appr_test');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString: 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d4_appr_test',
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
      "CREATE ROLE d4_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d4_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://d4_login:' + password + '@127.0.0.1:' + port + '/d4_appr_test',
  };
}

async function ticketFingerprint(db, tenantId, requestId) {
  return withTenant(db, tenantId, async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, state, credential_version,
             entitlement_snapshot::text AS entitlement,
             updated_at
      FROM tickets
      WHERE tenant_id = ${tenantId}::uuid
        AND request_id = ${requestId}::uuid
    `;
    return rows;
  });
}

async function eventAllocated(db, tenantId, eventId) {
  return withTenant(db, tenantId, async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT allocated
      FROM quota_buckets
      WHERE tenant_id = ${tenantId}::uuid
        AND event_id = ${eventId}::uuid
        AND scope = 'EVENT'
    `;
    return Number(rows[0].allocated);
  });
}

test('manual approval is audited, idempotent, and tenant-denied', { timeout: 120000 }, async () => {
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
      subject: 'reviewer',
      email: 'reviewer@example.com',
      emailVerified: true,
    });
    const owner = await users.upsertFromVerifiedIdentity({
      issuer,
      subject: 'attendee',
      email: 'attendee@example.com',
      emailVerified: true,
    });
    const limited = await users.upsertFromVerifiedIdentity({
      issuer,
      subject: 'clerk',
      email: 'clerk@example.com',
      emailVerified: true,
    });
    const outsider = await users.upsertFromVerifiedIdentity({
      issuer,
      subject: 'other-tenant',
      email: 'other@example.com',
      emailVerified: true,
    });

    const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const otherEventId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    const setup = await withTenant(db, tenantId, async (tx) => {
      await tx.tenant.create({ data: { id: tenantId, slug: 'appr', name: 'Approval' } });
      await tx.event.create({
        data: { tenantId, id: eventId, slug: 'launch', name: 'Launch', status: 'DRAFT' },
      });
      const membership = await grantMembership(tx, {
        tenantId,
        userId: staff.userId,
        role: 'MANAGER',
        permissions: ['redemption.approve'],
      });
      await grantEventAssignment(tx, {
        tenantId,
        eventId,
        membershipId: membership.membershipId,
        permissions: ['redemption.approve'],
      });
      const limitedMembership = await grantMembership(tx, {
        tenantId,
        userId: limited.userId,
        role: 'CLERK',
        permissions: ['inventory.import'],
      });
      await grantEventAssignment(tx, {
        tenantId,
        eventId,
        membershipId: limitedMembership.membershipId,
        permissions: ['inventory.import'],
      });
      const seeded = await seedEventInventory(tx, HMAC, {
        tenantId,
        eventId,
        eventQuota: 2,
        rawCodes: ['APPROVE-ME', 'DENY-ME'],
      });
      const approveHold = await holdCodeForReview(tx, {
        tenantId,
        eventId,
        ownerUserId: owner.userId,
        codeId: seeded.codeIds[0],
      });
      const denyHold = await holdCodeForReview(tx, {
        tenantId,
        eventId,
        ownerUserId: owner.userId,
        codeId: seeded.codeIds[1],
      });
      return { approveHold, denyHold, seeded };
    });
    assert.equal(await eventAllocated(db, tenantId, eventId), 0);

    await withTenant(db, otherTenantId, async (tx) => {
      await tx.tenant.create({ data: { id: otherTenantId, slug: 'other', name: 'Other' } });
      await tx.event.create({
        data: { tenantId: otherTenantId, id: otherEventId, slug: 'other', name: 'Other', status: 'DRAFT' },
      });
      const membership = await grantMembership(tx, {
        tenantId: otherTenantId,
        userId: outsider.userId,
        role: 'MANAGER',
        permissions: ['redemption.approve'],
      });
      await grantEventAssignment(tx, {
        tenantId: otherTenantId,
        eventId: otherEventId,
        membershipId: membership.membershipId,
        permissions: ['redemption.approve'],
      });
    });

    const approveKey = randomUUID();
    const approved = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.approveHold.requestId,
        actorUserId: staff.userId,
        decision: 'approve',
        idempotencyKey: approveKey,
      }),
    );
    assert.equal(approved.ok, true);
    assert.equal(approved.result.status, 'ISSUED');
    assert.equal(approved.result.replayed, false);
    assert.equal(approved.result.ownerUserId, owner.userId);
    assert.ok(approved.result.ticketId);
    const fingerprint = await ticketFingerprint(db, tenantId, setup.approveHold.requestId);
    assert.equal(fingerprint.length, 1);
    assert.equal(fingerprint[0].state, 'ACTIVE');
    assert.equal(await eventAllocated(db, tenantId, eventId), 1);

    const replay = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.approveHold.requestId,
        actorUserId: staff.userId,
        decision: 'approve',
        idempotencyKey: approveKey,
      }),
    );
    assert.equal(replay.ok, true);
    assert.equal(replay.result.replayed, true);
    assert.equal(replay.result.ticketId, approved.result.ticketId);

    const again = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.approveHold.requestId,
        actorUserId: staff.userId,
        decision: 'approve',
        idempotencyKey: randomUUID(),
      }),
    );
    assert.equal(again.ok, true);
    assert.equal(again.result.ticketId, approved.result.ticketId);
    const afterReplay = await ticketFingerprint(db, tenantId, setup.approveHold.requestId);
    assert.deepEqual(afterReplay, fingerprint);
    assert.equal(await eventAllocated(db, tenantId, eventId), 1);

    const audits = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`
        SELECT count(*)::int AS n
        FROM audit_logs
        WHERE tenant_id = ${tenantId}::uuid
          AND action = 'redemption.approved'
          AND resource_id = ${setup.approveHold.requestId}::uuid
      `,
    );
    assert.equal(audits[0].n, 1);

    const deniedIssue = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.approveHold.requestId,
        actorUserId: staff.userId,
        decision: 'deny',
        idempotencyKey: randomUUID(),
        reason: 'too late',
      }),
    );
    assert.equal(deniedIssue.ok, false);
    assert.equal(deniedIssue.rejection.code, APPROVAL_ERROR_CODES.DECISION_CONFLICT);
    assert.deepEqual(
      await ticketFingerprint(db, tenantId, setup.approveHold.requestId),
      fingerprint,
    );

    const denyKey = randomUUID();
    const denied = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.denyHold.requestId,
        actorUserId: staff.userId,
        decision: 'deny',
        idempotencyKey: denyKey,
        reason: 'not on the list',
      }),
    );
    assert.equal(denied.ok, true);
    assert.equal(denied.result.status, 'REJECTED');
    assert.equal(denied.result.ticketId, null);
    const denyReplay = await withTenant(db, tenantId, (tx) =>
      decideRedemption(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        requestId: setup.denyHold.requestId,
        actorUserId: staff.userId,
        decision: 'deny',
        idempotencyKey: denyKey,
        reason: 'not on the list',
      }),
    );
    assert.equal(denyReplay.ok, true);
    assert.equal(denyReplay.result.replayed, true);
    assert.equal(denyReplay.result.status, 'REJECTED');

    const deniedCode = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`
        SELECT status, active_request_id
        FROM redemption_codes
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${setup.seeded.codeIds[1]}::uuid
      `,
    );
    assert.equal(deniedCode[0].status, 'AVAILABLE');
    assert.equal(deniedCode[0].active_request_id, null);
    const deniedRequest = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`
        SELECT status, decision_reason
        FROM redemption_requests
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${setup.denyHold.requestId}::uuid
      `,
    );
    assert.equal(deniedRequest[0].status, 'REJECTED');
    assert.equal(deniedRequest[0].decision_reason, 'not on the list');
    const deniedTickets = await ticketFingerprint(db, tenantId, setup.denyHold.requestId);
    assert.equal(deniedTickets.length, 0);
    assert.equal(await eventAllocated(db, tenantId, eventId), 1);
    const denyAudits = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`
        SELECT count(*)::int AS n
        FROM audit_logs
        WHERE tenant_id = ${tenantId}::uuid
          AND action = 'redemption.denied'
          AND resource_id = ${setup.denyHold.requestId}::uuid
      `,
    );
    assert.equal(denyAudits[0].n, 1);

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          decideRedemption(tx, CREDENTIAL_KEY, {
            tenantId,
            eventId,
            requestId: setup.denyHold.requestId,
            actorUserId: outsider.userId,
            decision: 'approve',
            idempotencyKey: randomUUID(),
          }),
        ),
      (error) =>
        error instanceof AuthzError &&
        error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
    );
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          decideRedemption(tx, CREDENTIAL_KEY, {
            tenantId,
            eventId,
            requestId: setup.approveHold.requestId,
            actorUserId: limited.userId,
            decision: 'deny',
            idempotencyKey: randomUUID(),
          }),
        ),
      (error) =>
        error instanceof AuthzError &&
        error.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
    );
    assert.deepEqual(
      await ticketFingerprint(db, tenantId, setup.approveHold.requestId),
      fingerprint,
    );
  } finally {
    if (db) await db.$disconnect().catch(() => {});
    if (name) {
      try {
        docker('rm', '-f', name);
      } catch {
        /* container already gone */
      }
    }
  }
});

test(
  'manual redeem does not allocate, second account is blocked, approve issues one ticket, deny releases',
  { timeout: 120000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const alice = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'alice-manual',
        email: 'alice-manual@example.com',
        emailVerified: true,
      });
      const bob = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'bob-manual',
        email: 'bob-manual@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'staff-manual',
        email: 'staff-manual@example.com',
        emailVerified: true,
      });
      const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const seeded = await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({ data: { id: tenantId, slug: 'manual', name: 'Manual' } });
        await tx.event.create({
          data: { tenantId, id: eventId, slug: 'manual', name: 'Manual', status: 'DRAFT' },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: ['redemption.approve'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['redemption.approve'],
        });
        const inventory = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['HOLD-ME', 'DENY-HOLD'],
        });
        await tx.$executeRaw`
          UPDATE issuance_sources
          SET approval_mode = 'MANUAL', updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${inventory.sourceId}::uuid
        `;
        return inventory;
      });

      const aliceKey = randomUUID();
      const pending = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'HOLD-ME',
          idempotencyKey: aliceKey,
        }),
      );
      assert.equal(pending.ok, 'pending');
      assert.equal(pending.result.code, APPROVAL_PENDING);
      assert.equal(pending.result.status, 'PENDING_REVIEW');
      assert.equal(pending.result.replayed, false);
      assert.equal('ticketId' in pending.result, false);
      assert.equal(await eventAllocated(db, tenantId, eventId), 0);
      const pendingTickets = await ticketFingerprint(db, tenantId, pending.result.requestId);
      assert.equal(pendingTickets.length, 0);

      const replay = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'HOLD-ME',
          idempotencyKey: aliceKey,
        }),
      );
      assert.equal(replay.ok, 'pending');
      assert.equal(replay.result.replayed, true);
      assert.equal(replay.result.requestId, pending.result.requestId);
      assert.equal(await eventAllocated(db, tenantId, eventId), 0);

      const blocked = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: bob.userId,
          actorEmail: bob.email,
          emailVerified: true,
          rawCode: 'HOLD-ME',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(blocked.ok, false);
      assert.equal(blocked.rejection.code, ISSUE_ERROR_CODES.CODE_DISABLED);
      assert.equal(await eventAllocated(db, tenantId, eventId), 0);
      assert.equal(
        (await ticketFingerprint(db, tenantId, pending.result.requestId)).length,
        0,
      );

      const approveKey = randomUUID();
      const approved = await withTenant(db, tenantId, (tx) =>
        decideRedemption(tx, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          requestId: pending.result.requestId,
          actorUserId: staff.userId,
          decision: 'approve',
          idempotencyKey: approveKey,
        }),
      );
      assert.equal(approved.ok, true);
      assert.equal(approved.result.status, 'ISSUED');
      assert.ok(approved.result.ticketId);
      assert.equal(await eventAllocated(db, tenantId, eventId), 1);
      const issued = await ticketFingerprint(db, tenantId, pending.result.requestId);
      assert.equal(issued.length, 1);

      const approveReplay = await withTenant(db, tenantId, (tx) =>
        decideRedemption(tx, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          requestId: pending.result.requestId,
          actorUserId: staff.userId,
          decision: 'approve',
          idempotencyKey: approveKey,
        }),
      );
      assert.equal(approveReplay.ok, true);
      assert.equal(approveReplay.result.replayed, true);
      assert.equal(approveReplay.result.ticketId, approved.result.ticketId);
      assert.equal(await eventAllocated(db, tenantId, eventId), 1);
      assert.equal(
        (await ticketFingerprint(db, tenantId, pending.result.requestId)).length,
        1,
      );

      const denyPending = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: bob.userId,
          actorEmail: bob.email,
          emailVerified: true,
          rawCode: 'DENY-HOLD',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(denyPending.ok, 'pending');
      assert.equal(await eventAllocated(db, tenantId, eventId), 1);

      const denied = await withTenant(db, tenantId, (tx) =>
        decideRedemption(tx, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          requestId: denyPending.result.requestId,
          actorUserId: staff.userId,
          decision: 'deny',
          idempotencyKey: randomUUID(),
          reason: 'duplicate guest',
        }),
      );
      assert.equal(denied.ok, true);
      assert.equal(denied.result.ticketId, null);
      assert.equal(denied.result.status, 'REJECTED');
      assert.equal(
        (await ticketFingerprint(db, tenantId, denyPending.result.requestId)).length,
        0,
      );
      assert.equal(await eventAllocated(db, tenantId, eventId), 1);
      const released = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT c.status AS code_status, r.status AS request_status, r.decision_reason
          FROM redemption_codes c
          JOIN redemption_requests r
            ON r.tenant_id = c.tenant_id AND r.redemption_code_id = c.id
          WHERE c.tenant_id = ${tenantId}::uuid
            AND c.id = ${seeded.codeIds[1]}::uuid
            AND r.id = ${denyPending.result.requestId}::uuid
        `,
      );
      assert.equal(released[0].code_status, 'AVAILABLE');
      assert.equal(released[0].request_status, 'REJECTED');
      assert.equal(released[0].decision_reason, 'duplicate guest');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* container already gone */
        }
      }
    }
  },
);
