const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  getOperationForActor,
  readCodeHmacEnvironment,
  IssueError,
  ISSUE_ERROR_CODES,
  REDEEM_COMMAND,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd08-fault-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'd08-fault-test-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-db08-fault-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_ef1e3e5498d7',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d08_fault_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
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
        'd08_fault_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'task database must become ready');
  const binding = docker('port', name, '5432/tcp');
  const port = binding.split(':').at(-1);
  const adminConfig = {
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d08_fault_test',
    connectionTimeoutMillis: 1000,
    query_timeout: 5000,
  };
  let admin;
  let connectionError;
  for (let i = 0; i < 30; i++) {
    const candidate = new Client(adminConfig);
    try {
      await candidate.connect();
      await candidate.query('SELECT 1');
      admin = candidate;
      break;
    } catch (error) {
      connectionError = error;
      await candidate.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(admin, 'tcp ready: ' + connectionError);
  await admin.query(
    'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query(
    'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query(
    'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of MIGRATIONS) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE d08_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO d08_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://d08_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d08_fault_test',
  };
}

async function seedTenantEvent(db, tenantId, eventId, slug) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'tenant-' + slug, name: 'T ' + slug },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug,
        name: 'Event ' + slug,
        status: 'PUBLISHED',
      },
    });
  });
}

/** Commit withTenant first, then map terminal rejection outside the tx. */
async function redeemOutsideTx(db, input) {
  const outcome = await withTenant(db, input.tenantId, (tx) =>
    redeemAndIssueTicket(tx, HMAC, CRED_KEY, input),
  );
  return unwrapRedeemOutcome(outcome);
}

/**
 * Run redeemAndIssueTicket inside a transaction we control directly (same
 * seam withTenant uses), then force the whole transaction to abort *after*
 * the business logic has run but *before* Prisma issues COMMIT — simulating
 * a crash/dropped-connection right before commit (DB-08).
 */
async function redeemThenCrashBeforeCommit(db, input) {
  const fault = new Error('INJECTED_FAULT_BEFORE_COMMIT');
  let sawOutcome = null;
  await assert.rejects(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`;
          await tx.$queryRaw`SELECT set_config('statement_timeout', '5000', true)`;
          sawOutcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, input);
          // Never reached by a real client, but proves business mutations
          // (code/quota/ticket/outbox/operation) happened pre-crash.
          throw fault;
        },
        { maxWait: 5000, timeout: 10000 },
      ),
    (error) => error === fault,
  );
  return sawOutcome;
}

test(
  'DB-08: fault before commit rolls back ticket/quota/code/operation/outbox; lost response after commit reconciles same key; operation lookup scoped to actor/event/command',
  { timeout: 240000 },
  async () => {
    let started = false;
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      started = true;
      db = createDatabase(boot.url, 4);

      const users = createPrismaIdentityUserRepository(db);
      const alice = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'alice-db08',
        email: 'alice-db08@example.com',
        emailVerified: true,
      });
      const bob = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'bob-db08',
        email: 'bob-db08@example.com',
        emailVerified: true,
      });

      const T = 'd0800000-0000-4000-8000-000000000001';
      const eventA = 'd0800000-0000-4000-8000-00000000000a';
      const eventB = 'd0800000-0000-4000-8000-00000000000b';
      await seedTenantEvent(db, T, eventA, 'db08-fault');
      await withTenant(db, T, async (tx) => {
        await tx.event.create({
          data: {
            tenantId: T,
            id: eventB,
            slug: 'db08-fault-other-event',
            name: 'Other event',
            status: 'PUBLISHED',
          },
        });
      });
      await withTenant(db, T, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: T,
          eventId: eventA,
          eventQuota: 5,
          rawCodes: ['FAULT-CODE', 'LOST-CODE'],
        });
      });

      // --- 1) Fault injected before commit must roll back everything. ---
      const crashKey = randomUUID();
      const baselineBeforeCrash = await withTenant(db, T, async (tx) => {
        const ops = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM operations
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT scope, allocated FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
          ORDER BY scope
        `;
        const codes = await tx.$queryRaw`
          SELECT status FROM redemption_codes
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
          ORDER BY status
        `;
        return { ops: ops[0].n, tickets: tickets[0].n, outbox: outbox[0].n, quotas, codes };
      });
      assert.equal(baselineBeforeCrash.ops, 0);
      assert.equal(baselineBeforeCrash.tickets, 0);
      assert.equal(baselineBeforeCrash.outbox, 0);
      assert.deepEqual(
        baselineBeforeCrash.codes.map((c) => c.status).sort(),
        ['AVAILABLE', 'AVAILABLE'],
      );

      const sawOutcome = await redeemThenCrashBeforeCommit(db, {
        tenantId: T,
        eventId: eventA,
        actorUserId: alice.userId,
        actorEmail: alice.email,
        emailVerified: true,
        rawCode: 'FAULT-CODE',
        idempotencyKey: crashKey,
      });
      // The business logic itself succeeded inside the doomed transaction
      // (proves the crash happened *after* mutation, not before it).
      assert.ok(sawOutcome && sawOutcome.ok === true, 'business ran before the injected crash');

      const afterCrash = await withTenant(db, T, async (tx) => {
        const ops = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM operations
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT scope, allocated FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
          ORDER BY scope
        `;
        const codes = await tx.$queryRaw`
          SELECT status FROM redemption_codes
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
          ORDER BY status
        `;
        const opRow = await getOperationForActor(tx, {
          tenantId: T,
          eventId: eventA,
          actorUserId: alice.userId,
          command: REDEEM_COMMAND,
          clientKey: crashKey,
        });
        return {
          ops: ops[0].n,
          tickets: tickets[0].n,
          outbox: outbox[0].n,
          quotas,
          codes,
          opRow,
        };
      });
      assert.equal(afterCrash.ops, 0, 'operation claim must not survive a pre-commit crash');
      assert.equal(afterCrash.tickets, 0, 'ticket insert must not survive a pre-commit crash');
      assert.equal(afterCrash.outbox, 0, 'outbox insert must not survive a pre-commit crash');
      for (const q of afterCrash.quotas) {
        assert.equal(Number(q.allocated), 0, 'quota bucket ' + q.scope + ' must roll back to 0');
      }
      assert.deepEqual(
        afterCrash.codes.map((c) => c.status).sort(),
        ['AVAILABLE', 'AVAILABLE'],
        'redemption code must roll back to AVAILABLE',
      );
      assert.equal(afterCrash.opRow, null, 'no operation row must be visible after rollback');

      // A plain retry with the *same* key after the crash must succeed cleanly,
      // proving the rollback left no half-mutated state blocking recovery.
      const recovered = await redeemOutsideTx(db, {
        tenantId: T,
        eventId: eventA,
        actorUserId: alice.userId,
        actorEmail: alice.email,
        emailVerified: true,
        rawCode: 'FAULT-CODE',
        idempotencyKey: crashKey,
      });
      assert.equal(recovered.replayed, false);
      assert.equal(recovered.state, 'ACTIVE');

      const afterRecovery = await withTenant(db, T, async (tx) => {
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT SUM(allocated)::int AS n FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid AND scope = 'EVENT'
        `;
        return { tickets: tickets[0].n, outbox: outbox[0].n, allocated: quotas[0].n };
      });
      assert.equal(afterRecovery.tickets, 1, 'exactly one ticket after recovery, not a duplicate');
      assert.equal(afterRecovery.outbox, 1, 'exactly one outbox row after recovery');
      assert.equal(afterRecovery.allocated, 1);

      // --- 2) Lost response after commit: retry same key reconciles to the
      // same result instead of re-mutating (the client never saw the first
      // response, but the operation row already committed). ---
      const lostKey = randomUUID();
      const first = await redeemOutsideTx(db, {
        tenantId: T,
        eventId: eventA,
        actorUserId: bob.userId,
        actorEmail: bob.email,
        emailVerified: true,
        rawCode: 'LOST-CODE',
        idempotencyKey: lostKey,
      });
      assert.equal(first.replayed, false);

      for (let attempt = 0; attempt < 3; attempt++) {
        const retried = await redeemOutsideTx(db, {
          tenantId: T,
          eventId: eventA,
          actorUserId: bob.userId,
          actorEmail: bob.email,
          emailVerified: true,
          rawCode: 'LOST-CODE',
          idempotencyKey: lostKey,
        });
        assert.equal(retried.replayed, true, 'attempt ' + attempt + ' must replay, not re-mutate');
        assert.equal(retried.ticketId, first.ticketId);
        assert.equal(retried.requestId, first.requestId);
        assert.equal(retried.operationId, first.operationId);
        assert.equal(retried.ticketTypeId, first.ticketTypeId);
        assert.equal(retried.sourceId, first.sourceId);
        assert.equal(retried.credentialVersion, first.credentialVersion);
      }

      const afterLostRetries = await withTenant(db, T, async (tx) => {
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets WHERE id = ${first.ticketId}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox WHERE aggregate_id = ${first.ticketId}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT SUM(allocated)::int AS n FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventA}::uuid AND scope = 'EVENT'
        `;
        return { tickets: tickets[0].n, outbox: outbox[0].n, allocated: quotas[0].n };
      });
      assert.equal(afterLostRetries.tickets, 1, 'lost-response retries must not duplicate the ticket');
      assert.equal(afterLostRetries.outbox, 1, 'lost-response retries must not duplicate the outbox row');
      assert.equal(afterLostRetries.allocated, 2, 'quota allocated must not move on replay (1 from recovery + 1 from this ticket)');

      // --- 3) Operation lookup must be scoped to (actor, event, command); a
      // matching client_key under a different actor/event/command must miss. ---
      const scoped = await withTenant(db, T, async (tx) => {
        const correct = await getOperationForActor(tx, {
          tenantId: T,
          eventId: eventA,
          actorUserId: bob.userId,
          command: REDEEM_COMMAND,
          clientKey: lostKey,
        });
        const wrongActor = await getOperationForActor(tx, {
          tenantId: T,
          eventId: eventA,
          actorUserId: alice.userId,
          command: REDEEM_COMMAND,
          clientKey: lostKey,
        });
        const wrongEvent = await getOperationForActor(tx, {
          tenantId: T,
          eventId: eventB,
          actorUserId: bob.userId,
          command: REDEEM_COMMAND,
          clientKey: lostKey,
        });
        const wrongCommand = await getOperationForActor(tx, {
          tenantId: T,
          eventId: eventA,
          actorUserId: bob.userId,
          command: 'some.other.command',
          clientKey: lostKey,
        });
        return { correct, wrongActor, wrongEvent, wrongCommand };
      });
      assert.ok(scoped.correct, 'exact actor/event/command/key must resolve');
      assert.equal(scoped.correct.status, 'COMPLETED');
      assert.equal(scoped.correct.response.ticketId, first.ticketId);
      assert.equal(scoped.wrongActor, null, 'a different actor must not see this operation');
      assert.equal(scoped.wrongEvent, null, 'a different event must not see this operation');
      assert.equal(scoped.wrongCommand, null, 'a different command must not see this operation');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (started && name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
