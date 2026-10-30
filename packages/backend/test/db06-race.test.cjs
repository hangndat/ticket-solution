const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { startPostgres } = require('../../../tests/e2e/backend/pg-fixture.cjs');
const {
  createDatabase, withTenant, createPrismaIdentityUserRepository,
  grantMembership, grantEventAssignment, seedEventInventory,
  redeemAndIssueTicket, updateEvent, saveEventConfigVersion,
  publishEventConfig, bootstrapPlatformOperator, setTenantStatus,
  configureIssuanceLockTimeout, readCodeHmacEnvironment,
  isRetryableTransactionConflict, ISSUE_ERROR_CODES, REDEEM_COMMAND,
  PLATFORM_ERROR_CODES,
} = require('../dist');

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'db06-synthetic-pepper', CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'db06-synthetic-credential';

function payload() {
  return {
    schemaVersion: 1,
    brand: { primaryColor: '#0B3D2E', organizationName: 'DB06' },
    sections: [
      { kind: 'hero', id: 'hero', visible: true, order: 0, body: { title: 'DB06', text: 'Race' } },
      { kind: 'info', id: 'info', visible: true, order: 1, body: { title: 'Info', text: 'Info' } },
      { kind: 'redeem', id: 'redeem', visible: true, order: 2, body: { title: 'Redeem', text: 'Code' } },
      { kind: 'guide', id: 'guide', visible: false, order: 3, body: { title: 'Guide', text: '' } },
      { kind: 'faq', id: 'faq', visible: true, order: 4, body: { title: 'FAQ', items: [] } },
      { kind: 'terms', id: 'terms', visible: true, order: 5,
        body: { title: 'Terms', termsVersion: 'terms-v2', text: 'Accept v2' } },
    ],
    termsVersion: 'terms-v2',
  };
}

async function fixture(t) {
  const pg = await startPostgres();
  t.after(() => pg.stop());
  const admin = new Client({ connectionString: pg.adminUrl });
  await admin.connect();
  try {
    await admin.query('GRANT ticket_platform_runtime TO e2e_login');
  } finally {
    await admin.end();
  }
  const db = createDatabase(pg.url, 12);
  t.after(() => db.$disconnect());
  const users = createPrismaIdentityUserRepository(db);
  const operator = await users.upsertFromVerifiedIdentity({
    issuer: 'https://idp.synthetic.test/realms/e2e', subject: 'db06-operator',
    email: 'db06-operator@example.test', emailVerified: true,
  });
  await bootstrapPlatformOperator(db, { userId: operator.userId });
  return { db, url: pg.url, users, operator };
}

async function scenario(base, label) {
  const tenantId = randomUUID();
  const eventId = randomUUID();
  const manager = await base.users.upsertFromVerifiedIdentity({
    issuer: 'https://idp.synthetic.test/realms/e2e', subject: `${label}-manager`,
    email: `${label}-manager@example.test`, emailVerified: true,
  });
  const attendee = await base.users.upsertFromVerifiedIdentity({
    issuer: 'https://idp.synthetic.test/realms/e2e', subject: `${label}-attendee`,
    email: `${label}-attendee@example.test`, emailVerified: true,
  });
  await withTenant(base.db, tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug: label, name: label } });
    await tx.event.create({ data: {
      tenantId, id: eventId, slug: label, name: label, status: 'PUBLISHED',
    } });
    const membership = await grantMembership(tx, {
      tenantId, userId: manager.userId, role: 'MANAGER',
      permissions: ['event.update', 'event.config', 'event.publish'],
    });
    await grantEventAssignment(tx, {
      tenantId, eventId, membershipId: membership.membershipId,
      permissions: ['event.update', 'event.config', 'event.publish'],
    });
    await seedEventInventory(tx, HMAC, {
      tenantId, eventId, eventQuota: 1, rawCodes: [`${label}-CODE`],
    });
  });
  return {
    ...base, tenantId, eventId, manager, attendee,
    value: {
      tenantId, eventId, actorUserId: attendee.userId, actorEmail: attendee.email,
      emailVerified: true, rawCode: `${label}-CODE`, idempotencyKey: randomUUID(),
    },
  };
}

function issue(f, configureTimeout = false) {
  return withTenant(f.db, f.tenantId, async (tx) => {
    if (configureTimeout) await configureIssuanceLockTimeout(tx);
    return redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, f.value);
  });
}

async function close(f, tx) {
  return updateEvent(tx, {
    tenantId: f.tenantId, eventId: f.eventId, actorUserId: f.manager.userId,
    idempotencyKey: randomUUID(),
    body: {
      expectedRevision: 1,
      redemptionOpensAt: '2019-01-01T00:00:00.000Z',
      redemptionClosesAt: '2020-01-01T00:00:00.000Z',
    },
  });
}

async function publishTerms(f, tx) {
  return publishEventConfig(tx, {
    tenantId: f.tenantId, eventId: f.eventId,
    actorUserId: f.manager.userId, expectedVersion: 1,
  });
}

async function saveTerms(f) {
  const saved = await withTenant(f.db, f.tenantId, (tx) =>
    saveEventConfigVersion(tx, {
      tenantId: f.tenantId, eventId: f.eventId,
      actorUserId: f.manager.userId, payload: payload(),
    }));
  assert.equal(saved.version, 1);
}

async function blockedBehind(url, blockerPid, queryFragment) {
  const observer = new Client({ connectionString: url });
  await observer.connect();
  try {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const { rows } = await observer.query(`
        SELECT pid, query FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock'
          AND $1::int = ANY(pg_blocking_pids(pid)) AND query LIKE $2
      `, [blockerPid, `%${queryFragment}%`]);
      if (rows.length) return rows[0];
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.fail(`${queryFragment} did not block behind PostgreSQL pid ${blockerPid}`);
  } finally {
    await observer.end();
  }
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

async function state(f) {
  return withTenant(f.db, f.tenantId, async (tx) => ({
    event: (await tx.$queryRaw`SELECT status, redemption_closes_at, published_config_version
      FROM events WHERE tenant_id = ${f.tenantId}::uuid AND id = ${f.eventId}::uuid`)[0],
    tenant: (await tx.$queryRaw`SELECT status FROM tenants WHERE id = ${f.tenantId}::uuid`)[0],
    tickets: await tx.$queryRaw`SELECT id, redemption_code_id FROM tickets
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
    codes: await tx.$queryRaw`SELECT id, status FROM redemption_codes
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
    quota: await tx.$queryRaw`SELECT scope, capacity, allocated FROM quota_buckets
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
    requests: await tx.$queryRaw`SELECT id FROM redemption_requests
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
    operations: await tx.$queryRaw`SELECT status, response_json FROM operations
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid
        AND command = ${REDEEM_COMMAND}`,
    audit: await tx.$queryRaw`SELECT action FROM audit_logs
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
    outbox: await tx.$queryRaw`SELECT type FROM outbox
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid`,
  }));
}

function assertState(s, issued, rejectionCode = null) {
  assert.equal(s.tickets.length, issued);
  assert.equal(s.requests.length, issued);
  assert.equal(s.codes.length, 1);
  assert.equal(s.codes[0].status, issued ? 'CONSUMED' : 'AVAILABLE');
  assert.equal(s.tickets[0]?.redemption_code_id, issued ? s.codes[0].id : undefined);
  assert.equal(s.quota.length, 3);
  for (const bucket of s.quota) {
    assert.equal(bucket.allocated, issued);
    assert.ok(bucket.allocated >= 0 &&
      (bucket.capacity === null || bucket.allocated <= bucket.capacity));
  }
  assert.equal(s.operations.length, 1);
  assert.equal(s.operations[0].status, 'COMPLETED');
  if (rejectionCode) assert.equal(s.operations[0].response_json.code, rejectionCode);
  else assert.equal(s.operations[0].response_json.ticketId, s.tickets[0].id);
  assert.equal(s.audit.filter((row) => row.action === 'ticket.issued').length, issued);
  assert.equal(s.outbox.filter((row) => row.type === 'TicketIssued').length, issued);
}

function assertPolicyApplied(s, policy) {
  if (policy === 'close') {
    assert.equal(s.event.redemption_closes_at?.toISOString(),
      '2020-01-01T00:00:00.000Z');
  } else {
    assert.equal(s.event.published_config_version, 1);
  }
}

test('DB-06: issue and close/config commands serialize on event row in both orders',
  { timeout: 180000 }, async (t) => {
    const base = await fixture(t);
    for (const policy of ['close', 'config']) {
      for (const first of ['policy', 'issue']) {
        const f = await scenario(base, `db06-${policy}-${first}`);
        if (policy === 'config') await saveTerms(f);
        const adminAction = policy === 'close' ? close : publishTerms;
        if (first === 'policy') {
          const held = await heldTransaction(f, (tx) => adminAction(f, tx));
          const contender = issue(f);
          contender.catch(() => {});
          try {
            // The operation insert takes an FK key-share lock on events first.
            await blockedBehind(f.url, held.pid, 'INSERT INTO operations');
          } finally {
            held.release();
          }
          await held.result;
          const outcome = await contender;
          assert.equal(outcome.ok, false);
          const rejection = policy === 'close'
            ? ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED : ISSUE_ERROR_CODES.TERMS_REQUIRED;
          assert.equal(outcome.rejection.code, rejection);
          const after = await state(f);
          assertPolicyApplied(after, policy);
          assertState(after, 0, rejection);
        } else {
          const held = await heldTransaction(f, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, f.value));
          const contender = withTenant(f.db, f.tenantId, (tx) => adminAction(f, tx));
          contender.catch(() => {});
          try {
            await blockedBehind(f.url, held.pid, 'FROM events');
          } finally {
            held.release();
          }
          assert.equal((await held.result).ok, true);
          await contender;
          const after = await state(f);
          assertPolicyApplied(after, policy);
          assertState(after, 1);
        }
      }
    }
  });

test('DB-06: issue commits before platform suspend, then later issue is denied',
  { timeout: 180000 }, async (t) => {
    const base = await fixture(t);
    const f = await scenario(base, 'db06-suspend');
    const held = await heldTransaction(f, (tx) =>
      redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, f.value));
    const suspend = setTenantStatus(f.db, {
      actorUserId: f.operator.userId, tenantId: f.tenantId,
      status: 'SUSPENDED', reason: 'DB-06 synthetic race', expectedVersion: 1,
    });
    try {
      await blockedBehind(f.url, held.pid, 'FROM tenants');
    } finally {
      held.release();
    }
    assert.equal((await held.result).ok, true);
    assert.equal((await suspend).status, 'SUSPENDED');
    assertState(await state(f), 1);
    const later = { ...f, value: { ...f.value, idempotencyKey: randomUUID() } };
    await assert.rejects(() => issue(later),
      (error) => error.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED);
    assertState(await state(f), 1);
  });

test('DB-06: diagnostic SQL quota reduction waits for issue or rejects oversell',
  { timeout: 180000 }, async (t) => {
    const base = await fixture(t);
    const reduction = (f, tx) => tx.$executeRaw`
      UPDATE quota_buckets SET capacity = 0
      WHERE tenant_id = ${f.tenantId}::uuid AND event_id = ${f.eventId}::uuid
        AND scope = 'EVENT'
    `;

    const policyFirst = await scenario(base, 'db06-quota-first');
    const heldReduction = await heldTransaction(policyFirst,
      (tx) => reduction(policyFirst, tx));
    const issueAfterReduction = issue(policyFirst);
    issueAfterReduction.catch(() => {});
    try {
      await blockedBehind(policyFirst.url, heldReduction.pid, "scope = 'EVENT'");
    } finally {
      heldReduction.release();
    }
    await heldReduction.result;
    const rejected = await issueAfterReduction;
    assert.equal(rejected.ok, false);
    assert.equal(rejected.rejection.code, ISSUE_ERROR_CODES.QUOTA_EXHAUSTED);
    const zero = await state(policyFirst);
    assertState(zero, 0, ISSUE_ERROR_CODES.QUOTA_EXHAUSTED);
    assert.equal(zero.quota.find((q) => q.scope === 'EVENT').capacity, 0);

    const issueFirst = await scenario(base, 'db06-issue-first');
    const heldIssue = await heldTransaction(issueFirst, (tx) =>
      redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, issueFirst.value));
    const reductionAfterIssue = withTenant(issueFirst.db, issueFirst.tenantId,
      (tx) => reduction(issueFirst, tx));
    const checked = assert.rejects(reductionAfterIssue,
      (error) => String(error.message).includes('23514'));
    try {
      await blockedBehind(issueFirst.url, heldIssue.pid, 'UPDATE quota_buckets');
    } finally {
      heldIssue.release();
    }
    assert.equal((await heldIssue.result).ok, true);
    await checked;
    const one = await state(issueFirst);
    assertState(one, 1);
    assert.equal(one.quota.find((q) => q.scope === 'EVENT').capacity, 1);
  });

test('DB-06: lock timeout returns bounded retryable conflict; same key succeeds after release',
  { timeout: 180000 }, async (t) => {
    const base = await fixture(t);
    const f = await scenario(base, 'db06-retry');
  const held = await heldTransaction(f, (tx) => updateEvent(tx, {
    tenantId: f.tenantId, eventId: f.eventId, actorUserId: f.manager.userId,
    idempotencyKey: randomUUID(), body: { expectedRevision: 1, name: 'Renamed' },
  }));
    const started = Date.now();
  const attempt = issue(f, true);
  const checked = assert.rejects(attempt,
    (error) => String(error.message).includes('55P03') &&
      isRetryableTransactionConflict(error));
    try {
    await blockedBehind(f.url, held.pid, 'INSERT INTO operations');
    await checked;
      assert.ok(Date.now() - started < 8000, 'lock wait must end before transaction timeout');
    } finally {
      held.release();
    }
    await held.result;
    const s = await state(f);
    assert.equal(s.operations.length, 0, 'retryable attempt rolls back operation claim');
    // Policy remains open; retry the original command after the transient lock clears.
    assert.equal((await issue(f, true)).ok, true);
    assertState(await state(f), 1);
  });
