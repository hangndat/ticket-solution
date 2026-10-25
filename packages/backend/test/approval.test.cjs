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
  decideRedemption,
  redeemAndIssueTicket,
  AuthzError,
  AUTHZ_ERROR_CODES,
  APPROVAL_ERROR_CODES,
  ApprovalError,
  APPROVAL_PENDING,
  ISSUE_ERROR_CODES,
  IssueError,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const MIGRATIONS = migrationFiles();

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
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
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

test('F01: mixed auto/manual contention preserves quota and replay across five events', { timeout: 120000 }, async (t) => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 20);
    const users = createPrismaIdentityUserRepository(db);
    const actors = [];
    for (let i = 0; i < 21; i++) {
      actors.push(await users.upsertFromVerifiedIdentity({
        issuer: 'https://atlas.example.test', subject: 'quota-' + i,
        email: 'quota-' + i + '@example.test', emailVerified: true,
      }));
    }
    const staff = actors[20];
    for (let round = 0; round < 5; round++) {
      const tenantId = randomUUID();
      const eventId = randomUUID();
      const manualSourceId = randomUUID();
      const manualTypeId = randomUUID();
      const codes = Array.from({ length: 20 }, (_, i) => 'ATLAS-' + round + '-' + i);
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({ data: { id: tenantId, slug: 'atlas-' + round, name: 'Atlas fixture' } });
        await tx.event.create({ data: { tenantId, id: eventId, slug: 'quota', name: 'Quota', status: 'DRAFT' } });
        const member = await grantMembership(tx, {
          tenantId, userId: staff.userId, role: 'MANAGER', permissions: ['redemption.approve'],
        });
        await grantEventAssignment(tx, {
          tenantId, eventId, membershipId: member.membershipId, permissions: ['redemption.approve'],
        });
        const inventory = await seedEventInventory(tx, HMAC, {
          tenantId, eventId, eventQuota: 7, typeQuota: 7, sourceQuota: 7, rawCodes: codes,
        });
        await tx.$executeRaw`
          INSERT INTO ticket_types (tenant_id, event_id, id, label, entitlement_snapshot)
          VALUES (${tenantId}::uuid, ${eventId}::uuid, ${manualTypeId}::uuid, 'Manual type', '{}'::jsonb)
        `;
        await tx.$executeRaw`
          INSERT INTO issuance_sources (tenant_id, event_id, id, name, approval_mode)
          VALUES (${tenantId}::uuid, ${eventId}::uuid, ${manualSourceId}::uuid, 'Manual source', 'MANUAL')
        `;
        await tx.$executeRaw`
          INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
          VALUES (${tenantId}::uuid, ${eventId}::uuid, ${manualSourceId}::uuid, ${manualTypeId}::uuid)
        `;
        await tx.$executeRaw`
          INSERT INTO quota_buckets (tenant_id, event_id, id, scope, scope_id, capacity, allocated)
          VALUES (${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid, 'TICKET_TYPE', ${manualTypeId}::uuid, 7, 0),
                 (${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid, 'ISSUANCE_SOURCE', ${manualSourceId}::uuid, 7, 0)
        `;
        for (const codeId of inventory.codeIds.slice(10)) {
          await tx.$executeRaw`
            UPDATE redemption_codes SET source_id = ${manualSourceId}::uuid, ticket_type_id = ${manualTypeId}::uuid
            WHERE tenant_id = ${tenantId}::uuid AND id = ${codeId}::uuid
          `;
        }
      });
      const jobs = [];
      const manualRequests = [];
      for (let i = 0; i < 20; i++) {
        const input = {
          tenantId, eventId, actorUserId: actors[i].userId, actorEmail: actors[i].email,
          emailVerified: true, rawCode: codes[i], idempotencyKey: randomUUID(),
        };
        if (i < 10) {
          jobs.push(() => withTenant(db, tenantId, tx => redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, input)));
        } else {
          const pending = await withTenant(db, tenantId, tx => redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, input));
          assert.equal(pending.ok, 'pending');
          manualRequests.push(pending.result.requestId);
          const decision = {
            tenantId, eventId, requestId: pending.result.requestId,
            actorUserId: staff.userId, decision: 'approve', idempotencyKey: randomUUID(),
          };
          jobs.push(() => withTenant(db, tenantId, tx => decideRedemption(tx, CREDENTIAL_KEY, decision)));
        }
      }
      // Alternate both paths; all calls use independent pool connections and
      // distinct actors/codes, so code/attendee locks cannot serialize the race.
      const interleaved = Array.from({ length: 10 }, (_, i) => [jobs[i], jobs[i + 10]]).flat();
      if (round % 2) interleaved.reverse();
      const results = await Promise.allSettled(interleaved.map(job => job()));
      const rejected = results.filter(result => result.status === 'rejected');
      t.diagnostic(JSON.stringify({ round, calls: 20, unexpectedErrors: rejected.length }));
      assert.equal(rejected.length, 0, 'no unhandled deadlock/timeout under mixed contention');
      const values = results.map(result => result.value);
      assert.equal(values.filter(result => result.ok === true).length, 7);
      assert.equal(values.filter(result => result.ok === false && result.rejection.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED).length, 13);
      // Same keys must replay terminal outcomes without consuming quota again.
      const replay = await Promise.all(interleaved.map(job => job()));
      assert.equal(replay.filter(result => result.ok === true).length, 7);
      for (let i = 0; i < results.length; i++) {
        assert.equal(replay[i].ok, values[i].ok);
        if (values[i].ok) {
          assert.equal(replay[i].result.ticketId, values[i].result.ticketId);
          assert.equal(replay[i].result.operationId, values[i].result.operationId);
          assert.equal(replay[i].result.replayed, true);
        } else {
          assert.equal(replay[i].rejection.code, values[i].rejection.code);
          assert.equal(replay[i].rejection.operationId, values[i].rejection.operationId);
        }
      }
      await withTenant(db, tenantId, async (tx) => {
        const tickets = await tx.$queryRaw`SELECT id, ticket_type_id, source_id, request_id, owner_user_id FROM tickets WHERE tenant_id = ${tenantId}::uuid`;
        const buckets = await tx.$queryRaw`SELECT scope, scope_id, capacity, allocated FROM quota_buckets WHERE tenant_id = ${tenantId}::uuid`;
        assert.equal(tickets.length, 7);
        assert.equal(new Set(tickets.map(ticket => ticket.request_id)).size, 7);
        for (const bucket of buckets) {
          const expected = bucket.scope === 'EVENT' ? tickets.length : tickets.filter(ticket =>
            (bucket.scope === 'TICKET_TYPE' ? ticket.ticket_type_id : ticket.source_id) === bucket.scope_id).length;
          assert.equal(bucket.allocated, expected);
          assert.ok(bucket.allocated <= bucket.capacity);
        }
        const counters = await tx.$queryRaw`
          SELECT a.user_id, c.issued_count FROM attendee_counters c
          JOIN event_attendees a ON a.tenant_id = c.tenant_id AND a.id = c.attendee_id
          WHERE c.tenant_id = ${tenantId}::uuid AND c.event_id = ${eventId}::uuid
        `;
        assert.equal(counters.reduce((sum, counter) => sum + counter.issued_count, 0), 7);
        for (const counter of counters) {
          assert.equal(counter.issued_count, tickets.filter(ticket => ticket.owner_user_id === counter.user_id).length);
        }
        const consumed = await tx.$queryRaw`SELECT id FROM redemption_codes WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND status = 'CONSUMED'`;
        assert.equal(consumed.length, 7);
        const outbox = await tx.$queryRaw`SELECT aggregate_id FROM outbox WHERE tenant_id = ${tenantId}::uuid AND type = 'TicketIssued'`;
        assert.equal(outbox.length, 7);
        assert.deepEqual(new Set(outbox.map(row => row.aggregate_id)), new Set(tickets.map(row => row.id)));
        const audits = await tx.$queryRaw`
          SELECT action FROM audit_logs WHERE tenant_id = ${tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND action IN ('ticket.issued', 'redemption.approved')
        `;
        assert.equal(audits.length, 7);
        const operations = await tx.$queryRaw`
          SELECT status FROM operations WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `;
        assert.equal(operations.length, 30);
        assert.ok(operations.every(operation => operation.status === 'COMPLETED'));
      });
      if (round === 0) {
        // Force a quota row lock timeout after the operation claim. The whole
        // transaction must roll back so the same key can safely be retried.
        const loser = Array.from({ length: 10 }, (_, i) => i).find(i => values[i * 2].ok === false);
        assert.notEqual(loser, undefined);
        await withTenant(db, tenantId, tx => tx.$executeRaw`
          UPDATE quota_buckets SET capacity = 8
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `);
        const retryKey = randomUUID();
        const retryInput = {
          tenantId, eventId, actorUserId: actors[loser].userId,
          actorEmail: actors[loser].email, emailVerified: true,
          rawCode: codes[loser], idempotencyKey: retryKey,
        };
        let lockAcquired;
        let releaseLock;
        const acquired = new Promise(resolve => { lockAcquired = resolve; });
        const release = new Promise(resolve => { releaseLock = resolve; });
        const holder = withTenant(db, tenantId, async tx => {
          await tx.$queryRaw`
            SELECT id FROM quota_buckets WHERE tenant_id = ${tenantId}::uuid
              AND event_id = ${eventId}::uuid AND scope = 'EVENT' FOR UPDATE
          `;
          lockAcquired();
          await release;
        });
        await acquired;
        try {
          await assert.rejects(() => withTenant(db, tenantId, async tx => {
            await tx.$executeRaw`SET LOCAL lock_timeout = '150ms'`;
            return redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, retryInput);
          }), error => error instanceof IssueError &&
            error.code === ISSUE_ERROR_CODES.RETRYABLE_CONFLICT && error.retryable);
        } finally {
          releaseLock();
          await holder;
        }
        await withTenant(db, tenantId, async tx => {
          const operations = await tx.$queryRaw`
            SELECT id FROM operations WHERE tenant_id = ${tenantId}::uuid
              AND event_id = ${eventId}::uuid AND client_key = ${retryKey}
          `;
          assert.equal(operations.length, 0, 'lock timeout must not commit IN_PROGRESS operation');
        });
        const recovered = await withTenant(db, tenantId, tx =>
          redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, retryInput));
        assert.equal(recovered.ok, true);
        assert.equal((await withTenant(db, tenantId, tx =>
          redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, retryInput))).result.ticketId,
        recovered.result.ticketId);
        assert.equal(await eventAllocated(db, tenantId, eventId), 8);

        const manualLoser = Array.from({ length: 10 }, (_, i) => i).find(i => values[i * 2 + 1].ok === false);
        assert.notEqual(manualLoser, undefined);
        await withTenant(db, tenantId, tx => tx.$executeRaw`
          UPDATE quota_buckets SET capacity = 9
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `);
        const approvalKey = randomUUID();
        const approvalInput = {
          tenantId, eventId, requestId: manualRequests[manualLoser],
          actorUserId: staff.userId, decision: 'approve', idempotencyKey: approvalKey,
        };
        let approvalLockAcquired;
        let releaseApprovalLock;
        const approvalAcquired = new Promise(resolve => { approvalLockAcquired = resolve; });
        const approvalRelease = new Promise(resolve => { releaseApprovalLock = resolve; });
        const approvalHolder = withTenant(db, tenantId, async tx => {
          await tx.$queryRaw`
            SELECT id FROM quota_buckets WHERE tenant_id = ${tenantId}::uuid
              AND event_id = ${eventId}::uuid AND scope = 'EVENT' FOR UPDATE
          `;
          approvalLockAcquired();
          await approvalRelease;
        });
        await approvalAcquired;
        try {
          await assert.rejects(() => withTenant(db, tenantId, async tx => {
            await tx.$executeRaw`SET LOCAL lock_timeout = '150ms'`;
            return decideRedemption(tx, CREDENTIAL_KEY, approvalInput);
          }), error => error instanceof ApprovalError &&
            error.code === APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT && error.retryable);
        } finally {
          releaseApprovalLock();
          await approvalHolder;
        }
        await withTenant(db, tenantId, async tx => {
          const operations = await tx.$queryRaw`
            SELECT id FROM operations WHERE tenant_id = ${tenantId}::uuid
              AND event_id = ${eventId}::uuid AND client_key = ${approvalKey}
          `;
          assert.equal(operations.length, 0);
        });
        const approved = await withTenant(db, tenantId, tx =>
          decideRedemption(tx, CREDENTIAL_KEY, approvalInput));
        assert.equal(approved.ok, true);
        const approvalReplay = await withTenant(db, tenantId, tx =>
          decideRedemption(tx, CREDENTIAL_KEY, approvalInput));
        assert.equal(approvalReplay.result.ticketId, approved.result.ticketId);
        assert.equal(approvalReplay.result.replayed, true);
        assert.equal(await eventAllocated(db, tenantId, eventId), 9);
      }
    }
  } finally {
    if (db) await db.$disconnect();
    if (name) docker('rm', '-f', '-v', name);
  }
});

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
