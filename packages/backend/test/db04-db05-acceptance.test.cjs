const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { startPostgres } = require('../../../tests/e2e/backend/pg-fixture.cjs');
require('./gate-test-credentials.cjs');
const {
  createDatabase, withTenant, createPrismaIdentityUserRepository,
  seedEventInventory, redeemAndIssueTicket, readCodeHmacEnvironment,
  ISSUE_ERROR_CODES,
} = require('../dist');

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'db04-db05-synthetic-pepper', CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'db04-db05-synthetic-credential';

async function fixture(t, label, codes, capacities, maxPerAttendee = null) {
  const pg = await startPostgres();
  t.after(() => pg.stop());
  const db = createDatabase(pg.url, 12);
  t.after(() => db.$disconnect());
  const tenantId = randomUUID();
  const eventId = randomUUID();
  const inventory = await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug: label, name: label } });
    await tx.event.create({ data: { tenantId, id: eventId, slug: label, name: label, status: 'PUBLISHED' } });
    const seeded = await seedEventInventory(tx, HMAC, {
      tenantId, eventId, eventQuota: Math.max(codes.length, 1), rawCodes: codes,
    });
    await tx.$executeRaw`
      UPDATE events SET max_tickets_per_attendee = ${maxPerAttendee}
      WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
    `;
    for (const [id, capacity] of [
      [seeded.eventBucketId, capacities.event],
      [seeded.typeBucketId, capacities.type],
      [seeded.sourceBucketId, capacities.source],
    ]) {
      await tx.$executeRaw`
        UPDATE quota_buckets SET capacity = ${capacity}
        WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid
      `;
    }
    return seeded;
  });
  return { db, url: pg.url, tenantId, eventId, inventory, users: createPrismaIdentityUserRepository(db) };
}

async function identity(f, subject, email, emailVerified = true) {
  return f.users.upsertFromVerifiedIdentity({
    issuer: 'https://idp.synthetic.test/realms/e2e', subject, email, emailVerified,
  });
}

function input(f, actor, code) {
  return {
    tenantId: f.tenantId, eventId: f.eventId, actorUserId: actor.userId,
    actorEmail: actor.email, emailVerified: actor.emailVerified,
    rawCode: code, idempotencyKey: randomUUID(),
  };
}

async function redeem(f, value) {
  return withTenant(f.db, f.tenantId, (tx) =>
    redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, value));
}

async function waitForBlockedQuery(url, blockerPid, sqlFragment, count = 1) {
  const observer = new Client({ connectionString: url });
  await observer.connect();
  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const { rows } = await observer.query(`
        SELECT pid, query FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock'
          AND $1::int = ANY(pg_blocking_pids(pid)) AND query LIKE $2
      `, [blockerPid, `%${sqlFragment}%`]);
      if (rows.length >= count) return rows.map(({ pid, query }) => ({ pid, query }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.fail(`contender never blocked on ${sqlFragment} behind PostgreSQL pid ${blockerPid}`);
  } finally {
    await observer.end();
  }
}

async function controlledRace(f, firstValue, contenderValues, contestedSql, finiteScope = null) {
  let releaseFirst;
  let firstReached;
  let firstFailed;
  const held = new Promise((resolve) => { releaseFirst = resolve; });
  const reached = new Promise((resolve, reject) => { firstReached = resolve; firstFailed = reject; });
  const first = withTenant(f.db, f.tenantId, async (tx) => {
    const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    const result = await redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, firstValue);
    assert.equal(result.ok, true, 'first transaction must reach the allocation before commit');
    if (finiteScope) {
      const quotas = await tx.$queryRaw`SELECT scope, capacity, allocated FROM quota_buckets
        WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`;
      const finite = quotas.find((row) => row.scope === finiteScope);
      assert.equal(finite.capacity, 1);
      assert.equal(finite.allocated, 1, 'first transaction holds the last finite seat before commit');
    } else {
      const counters = await tx.$queryRaw`SELECT issued_count FROM attendee_counters
        WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`;
      assert.equal(counters[0].issued_count, 1, 'first transaction holds the owner limit before commit');
    }
    firstReached(pid);
    await held;
    return result;
  });
  first.catch(firstFailed);
  const blockerPid = await reached;
  const contenders = contenderValues.map((value) => redeem(f, value));
  try {
    const blocked = await waitForBlockedQuery(f.url, blockerPid, contestedSql, contenderValues.length);
    assert.equal(blocked.length, contenderValues.length,
      'each contender must be waiting while first transaction is uncommitted');
  } catch (error) {
    releaseFirst();
    await Promise.allSettled([first, ...contenders]);
    throw error;
  } finally {
    releaseFirst();
  }
  return Promise.all([first, ...contenders]);
}

async function snapshot(f) {
  return withTenant(f.db, f.tenantId, async (tx) => ({
    tickets: await tx.$queryRaw`SELECT id, owner_user_id, redemption_code_id FROM tickets WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    codes: await tx.$queryRaw`SELECT id, status, active_request_id FROM redemption_codes WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    quota: await tx.$queryRaw`SELECT id, scope, capacity, allocated FROM quota_buckets WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    requests: await tx.$queryRaw`SELECT id, status FROM redemption_requests WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    operations: await tx.$queryRaw`SELECT id, client_key, status, response_json FROM operations WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    audit: await tx.$queryRaw`SELECT id, action FROM audit_logs WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    outbox: await tx.$queryRaw`SELECT id, type FROM outbox WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    attendees: await tx.$queryRaw`SELECT id, user_id, canonical_email FROM event_attendees WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY id`,
    counters: await tx.$queryRaw`SELECT attendee_id, issued_count, max_tickets FROM attendee_counters WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid ORDER BY attendee_id`,
  }));
}

test('DB-04: guest and unverified leave no hold; IdP email keeps dot/plus; multi-code owner limit', { timeout: 180000 }, async (t) => {
  const f = await fixture(t, 'db04', ['DB04-A', 'DB04-B', 'DB04-C'],
    { event: 3, type: 3, source: 3 }, 1);
  const unverified = await identity(f, 'unverified', 'person@example.test', false);
  const before = await snapshot(f);
  assert.equal(before.codes.length, 3);
  await assert.rejects(() => redeem(f, input(f, unverified, 'DB04-A')),
    (error) => error.code === ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED);
  assert.deepEqual(await snapshot(f), before, 'unverified cannot hold a code, pending request, quota or operation');
  // No actor identity is a guest. The service must reject before any mutation.
  await assert.rejects(() => redeem(f, {
    ...input(f, { userId: randomUUID(), email: 'guest@example.test', emailVerified: false }, 'DB04-A'),
  }), (error) => error.code === ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED);
  assert.deepEqual(await snapshot(f), before, 'guest cannot hold business state');

  const owner = await identity(f, 'owner', 'first.last+label@example.test');
  await withTenant(f.db, f.tenantId, async (tx) => {
    const attendeeId = randomUUID();
    await tx.$executeRaw`INSERT INTO event_attendees (tenant_id, event_id, id, user_id, canonical_email, created_at, updated_at)
      VALUES (${f.tenantId}::uuid, ${f.eventId}::uuid, ${attendeeId}::uuid, ${owner.userId}::uuid, ${owner.email}, now(), now())`;
    await tx.$executeRaw`INSERT INTO attendee_counters (tenant_id, event_id, attendee_id, issued_count, max_tickets, updated_at)
      VALUES (${f.tenantId}::uuid, ${f.eventId}::uuid, ${attendeeId}::uuid, 0, 1, now())`;
  });
  const outcomes = await controlledRace(f,
    input(f, owner, 'DB04-A'),
    ['DB04-B', 'DB04-C'].map((code) => input(f, owner, code)),
    'attendee_counters');
  assert.equal(outcomes.filter((x) => x.ok === true).length, 1);
  assert.equal(outcomes.filter((x) => x.ok === false && x.rejection.code === ISSUE_ERROR_CODES.ATTENDEE_LIMIT).length, 2);
  const after = await snapshot(f);
  assert.equal(after.attendees.length, 1);
  assert.equal(after.attendees[0].canonical_email, owner.email, 'do not strip IdP dot or plus');
  assert.equal(after.counters[0].issued_count, 1);
  assert.equal(after.counters[0].max_tickets, 1);
  assert.equal(after.tickets.length, 1);
  assert.equal(after.requests.length, 1);
  assert.equal(after.codes.filter((x) => x.status === 'CONSUMED').length, 1);
  assert.equal(after.codes.filter((x) => x.status === 'AVAILABLE').length, 2);
  assert.ok(after.codes.every((x) => x.status !== 'HELD'));
  assert.ok(after.quota.every((x) => x.allocated === 1));
  assert.equal(after.operations.length, 3);
  assert.ok(after.operations.every((x) => x.status === 'COMPLETED'));
  assert.equal(after.audit.filter((x) => x.action === 'ticket.issued').length, 1);
  assert.equal(after.outbox.filter((x) => x.type === 'TicketIssued').length, 1);
});

test('DB-05: each finite quota wins one seat while other scopes are nullable', { timeout: 240000 }, async (t) => {
  for (const finite of ['event', 'type', 'source']) {
    const capacities = { event: null, type: null, source: null, [finite]: 1 };
    const f = await fixture(t, `db05-${finite}`, [`DB05-${finite}-A`, `DB05-${finite}-B`], capacities);
    const a = await identity(f, `a-${finite}`, `a-${finite}@example.test`);
    const b = await identity(f, `b-${finite}`, `b-${finite}@example.test`);
    const results = await controlledRace(f,
      input(f, a, `DB05-${finite}-A`),
      [input(f, b, `DB05-${finite}-B`)],
      "scope = 'EVENT'",
      { event: 'EVENT', type: 'TICKET_TYPE', source: 'ISSUANCE_SOURCE' }[finite]);
    assert.equal(results.filter((x) => x.ok === true).length, 1, finite);
    assert.equal(results.filter((x) => x.ok === false && x.rejection.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED).length, 1, finite);
    const state = await snapshot(f);
    assert.equal(state.tickets.length, 1);
    assert.equal(state.requests.length, 1);
    assert.equal(state.codes.filter((x) => x.status === 'CONSUMED').length, 1);
    assert.equal(state.codes.filter((x) => x.status === 'AVAILABLE').length, 1);
    assert.equal(state.operations.length, 2);
    assert.equal(state.audit.filter((x) => x.action === 'ticket.issued').length, 1);
    assert.equal(state.outbox.filter((x) => x.type === 'TicketIssued').length, 1);
    for (const quota of state.quota) {
      assert.equal(quota.allocated, 1, `${finite}: ${quota.scope} allocated`);
      assert.ok(quota.allocated >= 0);
      if (quota.scope.toLowerCase().includes(finite === 'event' ? 'event' : finite === 'type' ? 'ticket_type' : 'issuance_source'))
        assert.equal(quota.capacity, 1);
      else assert.equal(quota.capacity, null);
      if (quota.capacity !== null) assert.ok(quota.allocated <= quota.capacity);
    }
  }
});

test('DB-05: rollback after all quota mutations restores code, operation and side effects', { timeout: 180000 }, async (t) => {
  const f = await fixture(t, 'db05-rollback', ['DB05-ROLLBACK'],
    { event: 1, type: 1, source: 1 });
  const actor = await identity(f, 'rollback', 'rollback@example.test');
  const value = input(f, actor, 'DB05-ROLLBACK');
  const before = await snapshot(f);
  await assert.rejects(() => withTenant(f.db, f.tenantId, async (tx) => {
    const result = await redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, value);
    assert.equal(result.ok, true);
    const rows = await tx.$queryRaw`SELECT scope, allocated FROM quota_buckets WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`;
    assert.equal(rows.length, 3);
    assert.ok(rows.every((x) => x.allocated === 1), 'fault occurs after event/type/source allocation');
    throw new Error('synthetic post-mutation transaction fault');
  }), /synthetic post-mutation transaction fault/);
  assert.deepEqual(await snapshot(f), before, 'all business, audit and outbox rows must roll back');
  const recovered = await redeem(f, value);
  assert.equal(recovered.ok, true, 'same key is retryable after rollback');
  const after = await snapshot(f);
  assert.equal(after.tickets.length, 1);
  assert.ok(after.quota.every((x) => x.allocated === 1));
});
