const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const {
  createDatabase, createPrismaIdentityUserRepository, withTenant,
  seedEventInventory, grantMembership, grantEventAssignment,
  holdCodeForReview, readCodeHmacEnvironment,
  isRetryableTransactionConflict, ApprovalError,
} = require('@ticket/backend');
const { migrationFiles } = require('../../../packages/backend/test/migration-files.cjs');
const { createApp } = require('../dist/app');
const { ApprovalService } = require('../dist/approval');

const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const hmac = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'f01-api-lock-test-pepper', CODE_HMAC_VERSION: '1',
});

async function isolatedDb() {
  const name = 'ticket-f01-api-' + randomBytes(5).toString('hex');
  const password = randomBytes(20).toString('hex');
  docker('run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=f01_test', '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
  try {
    for (let i = 0; i < 80; i++) {
      try {
        docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'f01_test');
        break;
      } catch {
        if (i === 79) throw new Error('Postgres did not start');
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    const port = docker('port', name, '5432/tcp').split(':').at(-1);
    const admin = new Client({ connectionString:
      `postgresql://postgres:${password}@127.0.0.1:${port}/f01_test` });
    await admin.connect();
    try {
      await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
      await admin.query('SET ROLE migration_owner');
      for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
      await admin.query('RESET ROLE');
      await admin.query(`CREATE ROLE f01_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
      await admin.query('GRANT ticket_runtime TO f01_login');
    } finally {
      await admin.end();
    }
    return { name, url: `postgresql://f01_login:${password}@127.0.0.1:${port}/f01_test` };
  } catch (error) {
    docker('rm', '-f', '-v', name);
    throw error;
  }
}

function heldRow(db, tenantId, sql) {
  let acquired;
  let release;
  const ready = new Promise(resolve => { acquired = resolve; });
  const done = new Promise(resolve => { release = resolve; });
  const holder = withTenant(db, tenantId, async tx => {
    await tx.$executeRawUnsafe(sql);
    acquired();
    await done;
  });
  return { ready, release, holder };
}

async function counts(db, tenantId, eventId, key) {
  return withTenant(db, tenantId, async tx => {
    const [tickets, quotas, counters, audits, outbox, operations] = await Promise.all([
      tx.$queryRaw`SELECT id FROM tickets WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid`,
      tx.$queryRaw`SELECT scope, allocated FROM quota_buckets WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid`,
      tx.$queryRaw`SELECT issued_count FROM attendee_counters WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid`,
      tx.$queryRaw`SELECT action FROM audit_logs WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND action IN ('ticket.issued', 'redemption.approved')`,
      tx.$queryRaw`SELECT aggregate_id FROM outbox WHERE tenant_id = ${tenantId}::uuid AND type = 'TicketIssued'`,
      tx.$queryRaw`SELECT status FROM operations WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND client_key = ${key}`,
    ]);
    return { tickets, quotas, counters, audits, outbox, operations };
  });
}

test('F01 HTTP: pre-savepoint lock waits roll back and same-key retry issues once',
  { timeout: 120000 }, async () => {
    let boot;
    let db;
    let app;
    try {
      boot = await isolatedDb();
      db = createDatabase(boot.url, 8);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'https://f01.example.test';
      const owner = await users.upsertFromVerifiedIdentity({ issuer, subject: 'owner', email: 'owner@example.test', emailVerified: true });
      const staff = await users.upsertFromVerifiedIdentity({ issuer, subject: 'staff', email: 'staff@example.test', emailVerified: true });
      const tenantId = randomUUID();
      const eventId = randomUUID();
      let manualRequestId;
      let membershipId;
      await withTenant(db, tenantId, async tx => {
        await tx.tenant.create({ data: { id: tenantId, slug: 'f01', name: 'F01', status: 'ACTIVE' } });
        await tx.event.create({ data: { tenantId, id: eventId, slug: 'event', name: 'Event', status: 'DRAFT' } });
        const membership = await grantMembership(tx, { tenantId, userId: staff.userId,
          role: 'MANAGER', permissions: ['redemption.approve'] });
        membershipId = membership.membershipId;
        await grantEventAssignment(tx, { tenantId, eventId, membershipId,
          permissions: ['redemption.approve'] });
        const seeded = await seedEventInventory(tx, hmac, { tenantId, eventId,
          eventQuota: 2, rawCodes: ['F01-AUTO', 'F01-MANUAL'] });
        await tx.$executeRaw`UPDATE issuance_sources SET approval_mode = 'MANUAL'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${seeded.sourceId}::uuid`;
        const held = await holdCodeForReview(tx, { tenantId, eventId,
          ownerUserId: owner.userId, codeId: seeded.codeIds[1] });
        manualRequestId = held.requestId;
        await tx.$executeRaw`UPDATE issuance_sources SET approval_mode = 'AUTO'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${seeded.sourceId}::uuid`;
      });
      const verifier = { async verifyBearerToken(auth) {
        const subject = auth === 'Bearer staff' ? 'staff' : auth === 'Bearer owner' ? 'owner' : null;
        if (!subject) throw new Error('Unexpected test authorization');
        return { issuer, subject, email: subject + '@example.test', emailVerified: true };
      } };
      app = await createApp({ logging: false, database: db, users, oidcVerifier: verifier,
        hmac, credentialKey: 'f01-local-credential-key',
        env: { ...process.env, CODE_HMAC_PEPPER: 'f01-api-lock-test-pepper',
          CODE_HMAC_VERSION: '1', TICKET_CREDENTIAL_KEY: 'f01-local-credential-key' } });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const base = `/v1/tenants/${tenantId}/events/${eventId}`;
      const scenarios = [
        { label: 'auto tenant policy', key: randomUUID(),
          lock: `SELECT id FROM tenants WHERE id = '${tenantId}'::uuid FOR UPDATE`,
          request: () => app.inject({ method: 'POST', url: base + '/redemptions',
            headers: { authorization: 'Bearer owner', 'idempotency-key': scenarios[0].key },
            payload: { code: 'F01-AUTO' } }) },
        { label: 'manual membership', key: randomUUID(),
          lock: `SELECT id FROM memberships WHERE tenant_id = '${tenantId}'::uuid AND id = '${membershipId}'::uuid FOR UPDATE`,
          request: () => app.inject({ method: 'POST',
            url: base + `/redemptions/${manualRequestId}/approve`,
            headers: { authorization: 'Bearer staff', 'idempotency-key': scenarios[1].key },
            payload: {} }) },
      ];
      const observed = [];
      for (const scenario of scenarios) {
        const before = await counts(db, tenantId, eventId, scenario.key);
        const lock = heldRow(db, tenantId, scenario.lock);
        await lock.ready;
        let response;
        try {
          response = await scenario.request();
          observed.push({ label: scenario.label, status: response.statusCode,
            code: response.json().code, retryable: response.json().retryable });
        } finally {
          lock.release();
          await lock.holder;
        }
        const rolledBack = await counts(db, tenantId, eventId, scenario.key);
        assert.deepEqual(rolledBack, before, scenario.label + ' did not roll back');
        const success = await scenario.request();
        assert.equal(success.statusCode, 201, scenario.label + ': ' + success.body);
        const replay = await scenario.request();
        assert.equal(replay.statusCode, 201);
        assert.equal(replay.json().ticketId, success.json().ticketId);
        assert.equal(replay.json().replayed, true);
        const after = await counts(db, tenantId, eventId, scenario.key);
        assert.equal(after.tickets.length, before.tickets.length + 1);
        assert.ok(after.quotas.every(q => q.allocated === after.tickets.length));
        assert.equal(after.counters.reduce((n, c) => n + c.issued_count, 0), after.tickets.length);
        assert.equal(after.audits.length, after.tickets.length);
        assert.equal(after.outbox.length, after.tickets.length);
        assert.deepEqual(after.operations.map(op => op.status), ['COMPLETED']);

        // A replay waits for the existing operation's FOR UPDATE before the
        // business savepoint. It must remain safe to retry with this key.
        const operationLock = heldRow(db, tenantId,
          `SELECT id FROM operations WHERE tenant_id = '${tenantId}'::uuid AND client_key = '${scenario.key}' FOR UPDATE`);
        await operationLock.ready;
        try {
          const blockedReplay = await scenario.request();
          assert.equal(blockedReplay.statusCode, 503, scenario.label + ' operation lock');
          assert.equal(blockedReplay.json().code, 'RETRYABLE_CONFLICT');
          assert.equal(blockedReplay.json().retryable, true);
        } finally {
          operationLock.release();
          await operationLock.holder;
        }
        const finalReplay = await scenario.request();
        assert.equal(finalReplay.statusCode, 201);
        assert.equal(finalReplay.json().ticketId, success.json().ticketId);
        assert.deepEqual(await counts(db, tenantId, eventId, scenario.key), after);
      }
      assert.deepEqual(observed, scenarios.map(scenario => ({
        label: scenario.label, status: 503, code: 'RETRYABLE_CONFLICT', retryable: true,
      })));

      // Real statement cancellation has SQLSTATE 57014, not 55P03.
      await assert.rejects(() => withTenant(db, tenantId, tx =>
        tx.$queryRaw`SELECT pg_sleep(6)`), error => {
        assert.equal(error.meta?.driverAdapterError?.cause?.code, '57014');
        assert.match(error.message, /statement timeout/);
        assert.equal(isRetryableTransactionConflict(error), false);
        return true;
      });
    } finally {
      if (app) await app.close();
      if (db) await db.$disconnect();
      if (boot) docker('rm', '-f', '-v', boot.name);
    }
  });

test('F01: transaction boundary maps serialization but leaves unrelated cancellation alone', async () => {
  const userId = randomUUID();
  const serviceFor = error => new ApprovalService({
    db: { $transaction: async () => { throw error; } },
    verifier: { verifyBearerToken: async () => ({ issuer: 'test', subject: 'staff',
      email: 'staff@example.test', emailVerified: true }) },
    users: { upsertFromVerifiedIdentity: async () => ({ userId }) },
    bootError: null, credentialKey: 'f01-local-credential-key',
  });
  const decide = service => service.decide('Bearer staff', randomUUID(), randomUUID(),
    randomUUID(), randomUUID(), 'approve');
  await assert.rejects(() => decide(serviceFor({ code: 'P2034' })), error =>
    error instanceof ApprovalError && error.code === 'RETRYABLE_CONFLICT' && error.retryable);
  for (const error of [{ code: 'P2010', meta: { code: '57014' } },
    { code: 'P2010', meta: { code: '23505' } }, { code: 'P2028' }]) {
    await assert.rejects(() => decide(serviceFor(error)), caught => caught === error);
  }
});
