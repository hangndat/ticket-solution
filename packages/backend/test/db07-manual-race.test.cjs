const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { startPostgres } = require('../../../tests/e2e/backend/pg-fixture.cjs');
const {
  createDatabase, withTenant, createPrismaIdentityUserRepository,
  grantMembership, grantEventAssignment, seedEventInventory,
  readCodeHmacEnvironment, redeemAndIssueTicket, decideRedemption,
  expirePendingRequest, APPROVAL_ERROR_CODES,
} = require('../dist');

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'db07-synthetic-pepper', CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'db07-synthetic-credential';

async function fixture(t) {
  const pg = await startPostgres();
  t.after(() => pg.stop());
  const db = createDatabase(pg.url, 12);
  t.after(() => db.$disconnect());
  const users = createPrismaIdentityUserRepository(db);
  return { db, url: pg.url, users };
}

async function scenario(base, label) {
  const tenantId = randomUUID();
  const eventId = randomUUID();
  const code = `DB07-${label}`;
  const actors = {};
  for (const role of ['attendee', 'approverA', 'approverB']) {
    actors[role] = await base.users.upsertFromVerifiedIdentity({
      issuer: 'https://idp.synthetic.test/realms/e2e',
      subject: `${label}-${role}`,
      email: `${label}-${role}@example.test`,
      emailVerified: true,
    });
  }
  await withTenant(base.db, tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug: label, name: label } });
    await tx.event.create({ data: {
      tenantId, id: eventId, slug: label, name: label, status: 'PUBLISHED',
    } });
    for (const role of ['approverA', 'approverB']) {
      const member = await grantMembership(tx, {
        tenantId, userId: actors[role].userId, role: 'MANAGER',
        permissions: ['redemption.approve'],
      });
      await grantEventAssignment(tx, {
        tenantId, eventId, membershipId: member.membershipId,
        permissions: ['redemption.approve'],
      });
    }
    const inventory = await seedEventInventory(tx, HMAC, {
      tenantId, eventId, eventQuota: 1, rawCodes: [code],
    });
    await tx.$executeRaw`UPDATE issuance_sources
      SET approval_mode = 'MANUAL', pending_ttl_hours = 3
      WHERE tenant_id = ${tenantId}::uuid AND id = ${inventory.sourceId}::uuid`;
  });
  const redeemInput = {
    tenantId, eventId, actorUserId: actors.attendee.userId,
    actorEmail: actors.attendee.email, emailVerified: true,
    rawCode: code, idempotencyKey: randomUUID(),
  };
  const pending = await withTenant(base.db, tenantId, (tx) =>
    redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, redeemInput));
  assert.equal(pending.ok, 'pending');
  const f = { ...base, tenantId, eventId, actors, code,
    requestId: pending.result.requestId, redeemInput };
  const initial = await state(f);
  assert.equal(initial.request.status, 'PENDING_REVIEW');
  assert.equal(initial.code.status, 'HELD');
  assert.equal(initial.code.active_request_id, f.requestId);
  assert.equal(initial.tickets.length, 0);
  assert.deepEqual(initial.quotas.map((q) => q.allocated), [0, 0, 0]);
  assert.equal(initial.audit.filter((a) => a.action === 'redemption.pending').length, 1);
  assert.equal(initial.outbox.length, 0);
  assert.ok(Math.abs(initial.request.expires_at.getTime() -
    initial.request.created_at.getTime() - 3 * 60 * 60 * 1000) < 5000,
  'pending TTL must come from issuance_sources.pending_ttl_hours=3');
  assert.equal(pending.result.expiresAt, initial.request.expires_at.toISOString());
  return f;
}

async function state(f) {
  return withTenant(f.db, f.tenantId, async (tx) => {
    const [request] = await tx.$queryRaw`SELECT status, expires_at, created_at, decision_reason
      FROM redemption_requests WHERE tenant_id=${f.tenantId}::uuid AND id=${f.requestId}::uuid`;
    const [code] = await tx.$queryRaw`SELECT status, active_request_id
      FROM redemption_codes WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid`;
    return {
      request, code,
      tickets: await tx.$queryRaw`SELECT id, request_id FROM tickets
        WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid`,
      quotas: await tx.$queryRaw`SELECT scope, allocated FROM quota_buckets
        WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid ORDER BY scope`,
      audit: await tx.$queryRaw`SELECT action FROM audit_logs
        WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid`,
      outbox: await tx.$queryRaw`SELECT type FROM outbox
        WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid`,
      operations: await tx.$queryRaw`SELECT command, status, response_json FROM operations
        WHERE tenant_id=${f.tenantId}::uuid AND event_id=${f.eventId}::uuid`,
    };
  });
}

function decide(f, role, decision, key, reason) {
  return withTenant(f.db, f.tenantId, (tx) =>
    decideRedemption(tx, CREDENTIAL_KEY, {
      tenantId: f.tenantId, eventId: f.eventId, requestId: f.requestId,
      actorUserId: f.actors[role].userId, decision, idempotencyKey: key,
      reason,
    }));
}

async function heldTransaction(f, action) {
  let release;
  let reached;
  let failed;
  const held = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve, reject) => { reached = resolve; failed = reject; });
  const result = withTenant(f.db, f.tenantId, async (tx) => {
    const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    const value = await action(tx);
    reached(pid);
    await held;
    return value;
  });
  result.catch(failed);
  return { result, pid: await ready, release };
}

async function blockedBehind(url, blockerPid) {
  const observer = new Client({ connectionString: url });
  await observer.connect();
  try {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const { rows } = await observer.query(`SELECT pid FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock'
          AND $1::int = ANY(pg_blocking_pids(pid))`, [blockerPid]);
      if (rows.length) return;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.fail(`contender did not block behind PostgreSQL pid ${blockerPid}`);
  } finally {
    await observer.end();
  }
}

function assertFinal(s, status) {
  assert.equal(s.request.status, status);
  const issued = status === 'ISSUED' ? 1 : 0;
  assert.equal(s.tickets.length, issued);
  assert.equal(s.code.status, issued ? 'CONSUMED' : status === 'PENDING_REVIEW' ? 'HELD' : 'AVAILABLE');
  if (status === 'PENDING_REVIEW' || issued) assert.ok(s.code.active_request_id);
  else assert.equal(s.code.active_request_id, null);
  for (const quota of s.quotas) assert.equal(quota.allocated, issued);
  assert.equal(s.audit.filter((a) => a.action === 'redemption.approved').length, issued);
  assert.equal(s.audit.filter((a) => a.action === 'redemption.denied').length, status === 'REJECTED' ? 1 : 0);
  assert.equal(s.audit.filter((a) => a.action === 'redemption.expired').length, status === 'EXPIRED' ? 1 : 0);
  assert.equal(s.outbox.filter((o) => o.type === 'TicketIssued').length, issued);
  assert.ok(s.operations.every((op) => op.status === 'COMPLETED'),
    'no decision or redeem operation may remain in progress');
}

test('DB-07: expiry commits before approval; code releases and replay cannot issue',
  { timeout: 180000 }, async (t) => {
    const f = await scenario(await fixture(t), 'db07-expiry-first');
    await withTenant(f.db, f.tenantId, (tx) => tx.$executeRaw`UPDATE redemption_requests
      SET expires_at=clock_timestamp() - interval '1 second'
      WHERE tenant_id=${f.tenantId}::uuid AND id=${f.requestId}::uuid`);
    const held = await heldTransaction(f, (tx) => expirePendingRequest(tx, {
      tenantId: f.tenantId, eventId: f.eventId, requestId: f.requestId,
    }));
    const key = randomUUID();
    const contender = decide(f, 'approverA', 'approve', key);
    contender.catch(() => {});
    try { await blockedBehind(f.url, held.pid); } finally { held.release(); }
    assert.equal((await held.result).expired, true);
    const rejected = await contender;
    assert.equal(rejected.ok, false);
    assert.equal(rejected.rejection.code, APPROVAL_ERROR_CODES.PENDING_EXPIRED);
    const replay = await decide(f, 'approverA', 'approve', key);
    assert.deepEqual(replay, rejected);
    assertFinal(await state(f), 'EXPIRED');
  });

test('DB-07: lazy approval expiry persists code release and audit with terminal replay',
  { timeout: 180000 }, async (t) => {
    const f = await scenario(await fixture(t), 'db07-lazy-expiry');
    await withTenant(f.db, f.tenantId, (tx) => tx.$executeRaw`UPDATE redemption_requests
      SET expires_at=clock_timestamp() - interval '1 second'
      WHERE tenant_id=${f.tenantId}::uuid AND id=${f.requestId}::uuid`);
    const key = randomUUID();
    const first = await decide(f, 'approverA', 'approve', key);
    assert.equal(first.ok, false);
    assert.equal(first.rejection.code, APPROVAL_ERROR_CODES.PENDING_EXPIRED);
    assertFinal(await state(f), 'EXPIRED');
    const replay = await decide(f, 'approverA', 'approve', key);
    assert.deepEqual(replay, first);
    assertFinal(await state(f), 'EXPIRED');
  });

test('DB-07: owner retry after TTL persists lazy expiry without quota or ticket',
  { timeout: 180000 }, async (t) => {
    const f = await scenario(await fixture(t), 'db07-owner-expiry');
    await withTenant(f.db, f.tenantId, (tx) => tx.$executeRaw`UPDATE redemption_requests
      SET expires_at=clock_timestamp() - interval '1 second'
      WHERE tenant_id=${f.tenantId}::uuid AND id=${f.requestId}::uuid`);
    const retry = await withTenant(f.db, f.tenantId, (tx) =>
      redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
        ...f.redeemInput, idempotencyKey: randomUUID(),
      }));
    assert.equal(retry.ok, false);
    assert.equal(retry.rejection.code, 'PENDING_EXPIRED');
    assertFinal(await state(f), 'EXPIRED');
  });

test('DB-07: two approvers and deny serialize behind first approval',
  { timeout: 180000 }, async (t) => {
    const f = await scenario(await fixture(t), 'db07-approve-first');
    const firstKey = randomUUID();
    const held = await heldTransaction(f, (tx) => decideRedemption(tx, CREDENTIAL_KEY, {
      tenantId: f.tenantId, eventId: f.eventId, requestId: f.requestId,
      actorUserId: f.actors.approverA.userId, decision: 'approve', idempotencyKey: firstKey,
    }));
    const second = decide(f, 'approverB', 'approve', randomUUID());
    second.catch(() => {});
    try { await blockedBehind(f.url, held.pid); } finally { held.release(); }
    const winner = await held.result;
    assert.equal(winner.ok, true);
    const loser = await second;
    assert.ok(loser.ok ? loser.result.ticketId === winner.result.ticketId :
      loser.rejection.code === APPROVAL_ERROR_CODES.DECISION_CONFLICT);
    const denied = await decide(f, 'approverB', 'deny', randomUUID(), 'too late');
    assert.equal(denied.ok, false);
    assert.equal(denied.rejection.code, APPROVAL_ERROR_CODES.DECISION_CONFLICT);
    const replay = await decide(f, 'approverA', 'approve', firstKey);
    assert.equal(replay.result.ticketId, winner.result.ticketId);
    assert.equal(replay.result.replayed, true);
    assertFinal(await state(f), 'ISSUED');
  });

test('DB-07: deny wins before approval and quota is rechecked at decision',
  { timeout: 180000 }, async (t) => {
    const base = await fixture(t);
    const deniedFixture = await scenario(base, 'db07-deny-first');
    const key = randomUUID();
    const held = await heldTransaction(deniedFixture, (tx) => decideRedemption(tx, CREDENTIAL_KEY, {
      tenantId: deniedFixture.tenantId, eventId: deniedFixture.eventId,
      requestId: deniedFixture.requestId,
      actorUserId: deniedFixture.actors.approverA.userId,
      decision: 'deny', idempotencyKey: key, reason: 'synthetic review denial',
    }));
    const contender = decide(deniedFixture, 'approverB', 'approve', randomUUID());
    contender.catch(() => {});
    try { await blockedBehind(base.url, held.pid); } finally { held.release(); }
    assert.equal((await held.result).result.status, 'REJECTED');
    assert.equal((await contender).rejection.code, APPROVAL_ERROR_CODES.DECISION_CONFLICT);
    const replay = await decide(deniedFixture, 'approverA', 'deny', key, 'synthetic review denial');
    assert.equal(replay.result.replayed, true);
    assertFinal(await state(deniedFixture), 'REJECTED');

    const quotaFixture = await scenario(base, 'db07-quota-recheck');
    await withTenant(base.db, quotaFixture.tenantId, (tx) => tx.$executeRaw`
      UPDATE quota_buckets SET capacity=0
      WHERE tenant_id=${quotaFixture.tenantId}::uuid AND event_id=${quotaFixture.eventId}::uuid`);
    const result = await decide(quotaFixture, 'approverA', 'approve', randomUUID());
    assert.equal(result.ok, false);
    assert.equal(result.rejection.code, APPROVAL_ERROR_CODES.QUOTA_EXHAUSTED);
    assertFinal(await state(quotaFixture), 'PENDING_REVIEW');
  });
