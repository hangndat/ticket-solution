const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
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
  relayOutboxOnce,
  createFailingEmailAdapter,
  createNoopEmailAdapter,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = [
  'prisma/migrations/202610160001_foundation/migration.sql',
  'prisma/migrations/202610160002_d1_users/migration.sql',
  'prisma/migrations/202610160003_d1_membership/migration.sql',
  'prisma/migrations/202610160004_d2_issue_ticket/migration.sql',
  'prisma/migrations/202610170005_d3_gate/migration.sql',
  'prisma/migrations/202610170006_d4_config_publish/migration.sql',
];

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd2-issue-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'd2-issue-test-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-d2-issue-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_fbaf3fd3934f',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d2_issue_test',
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
        'd2_issue_test',
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
      '/d2_issue_test',
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
    'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of MIGRATIONS) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE d2_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO d2_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://d2_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d2_issue_test',
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

test(
  'issue: last-seat concurrency, idempotency, email fail keeps ticket, RLS',
  { timeout: 240000 },
  async () => {
    let started = false;
    let name;
    let db;
    let db2;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      started = true;
      db = createDatabase(boot.url, 4);
      db2 = createDatabase(boot.url, 2);

      const users = createPrismaIdentityUserRepository(db);
      const alice = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'alice',
        email: 'alice@example.com',
        emailVerified: true,
      });
      const bob = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'bob',
        email: 'bob@example.com',
        emailVerified: true,
      });
      const unverified = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'unverified',
        email: 'nope@example.com',
        emailVerified: false,
      });

      const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const eventA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const eventB = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const eventMail = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

      await seedTenantEvent(db, A, eventA, 'launch-a');
      await seedTenantEvent(db, B, eventB, 'launch-b');

      await withTenant(db, B, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: B,
          eventId: eventB,
          eventQuota: 10,
          rawCodes: ['OTHER-TENANT-CODE'],
        });
      });

      await withTenant(db, A, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: A,
          eventId: eventA,
          eventQuota: 1,
          rawCodes: ['LAST-SEAT', 'SECOND-CODE'],
        });
      });

      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: A,
            eventId: eventA,
            actorUserId: unverified.userId,
            actorEmail: unverified.email,
            emailVerified: false,
            rawCode: 'SECOND-CODE',
            idempotencyKey: randomUUID(),
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED,
      );

      const keyAlice = randomUUID();
      const keyBob = randomUUID();
      const raced = await Promise.allSettled([
        redeemOutsideTx(db, {
          tenantId: A,
          eventId: eventA,
          actorUserId: alice.userId,
          actorEmail: alice.email,
          emailVerified: true,
          rawCode: 'LAST-SEAT',
          idempotencyKey: keyAlice,
        }),
        redeemOutsideTx(db2, {
          tenantId: A,
          eventId: eventA,
          actorUserId: bob.userId,
          actorEmail: bob.email,
          emailVerified: true,
          rawCode: 'LAST-SEAT',
          idempotencyKey: keyBob,
        }),
      ]);

      const wins = raced.filter((r) => r.status === 'fulfilled');
      const losses = raced.filter((r) => r.status === 'rejected');
      assert.equal(wins.length, 1, 'exactly one issuer wins last seat');
      assert.equal(losses.length, 1);
      const loss = losses[0].reason;
      assert.ok(
        loss instanceof IssueError &&
          (loss.code === ISSUE_ERROR_CODES.CODE_CONSUMED ||
            loss.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED),
        'loser code=' + (loss && loss.code),
      );

      const winner = wins[0].value;
      assert.equal(winner.state, 'ACTIVE');
      assert.equal(winner.replayed, false);

      const winMeta = await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT owner_user_id FROM tickets WHERE id = ${winner.ticketId}::uuid
        `;
        return { ownerUserId: rows[0].owner_user_id };
      });
      const winActor =
        winMeta.ownerUserId === alice.userId
          ? { userId: alice.userId, email: alice.email, key: keyAlice }
          : { userId: bob.userId, email: bob.email, key: keyBob };
      const loseActor =
        winActor.userId === alice.userId
          ? { userId: bob.userId, email: bob.email, key: keyBob }
          : { userId: alice.userId, email: alice.email, key: keyAlice };

      // Post-race reconcile: counters / tickets / code / ops / outbox (TD §8.1).
      const reconcile = await withTenant(db, A, async (tx) => {
        const tickets = await tx.$queryRaw`
          SELECT state FROM tickets WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT scope, capacity, allocated FROM quota_buckets
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
          ORDER BY scope
        `;
        const codes = await tx.$queryRaw`
          SELECT status FROM redemption_codes
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
          ORDER BY status
        `;
        const ops = await tx.$queryRaw`
          SELECT actor_user_id::text AS actor, client_key::text AS client_key,
                 status, response_json
          FROM operations
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
            AND command = ${REDEEM_COMMAND}
          ORDER BY created_at
        `;
        const outbox = await tx.$queryRaw`
          SELECT type, status FROM outbox
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
        `;
        return { tickets, quotas, codes, ops, outbox };
      });

      assert.equal(reconcile.tickets.length, 1);
      assert.equal(reconcile.tickets[0].state, 'ACTIVE');
      for (const q of reconcile.quotas) {
        if (q.capacity !== null) {
          assert.equal(
            Number(q.allocated),
            1,
            'quota ' + q.scope + ' allocated',
          );
        }
      }
      const codeStatuses = reconcile.codes.map((c) => c.status).sort();
      assert.deepEqual(codeStatuses, ['AVAILABLE', 'CONSUMED']);
      assert.equal(
        reconcile.ops.length,
        2,
        'winner + loser terminal operations must both be durable',
      );
      assert.ok(
        reconcile.ops.every((o) => o.status === 'COMPLETED'),
        'both ops COMPLETED',
      );
      const loserOp = reconcile.ops.find(
        (o) => o.client_key === loseActor.key,
      );
      assert.ok(loserOp, 'loser operation row present');
      assert.equal(loserOp.actor, loseActor.userId);
      assert.equal(loserOp.response_json.code, loss.code);
      assert.equal(loserOp.response_json.retryable, false);
      assert.ok(!('ticketId' in loserOp.response_json));
      assert.equal(reconcile.outbox.length, 1);
      assert.equal(reconcile.outbox[0].type, 'TicketIssued');
      assert.equal(reconcile.outbox[0].status, 'PENDING');

      const loserVisible = await withTenant(db, A, (tx) =>
        getOperationForActor(tx, {
          tenantId: A,
          eventId: eventA,
          actorUserId: loseActor.userId,
          command: REDEEM_COMMAND,
          clientKey: loseActor.key,
        }),
      );
      assert.ok(loserVisible);
      assert.equal(loserVisible.status, 'COMPLETED');
      assert.equal(loserVisible.response.code, loss.code);

      const replay = await redeemOutsideTx(db, {
        tenantId: A,
        eventId: eventA,
        actorUserId: winActor.userId,
        actorEmail: winActor.email,
        emailVerified: true,
        rawCode: 'LAST-SEAT',
        idempotencyKey: winActor.key,
      });
      assert.equal(replay.ticketId, winner.ticketId);
      assert.equal(replay.replayed, true);

      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: A,
            eventId: eventA,
            actorUserId: winActor.userId,
            actorEmail: winActor.email,
            emailVerified: true,
            rawCode: 'SECOND-CODE',
            idempotencyKey: winActor.key,
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      );

      const other =
        winActor.userId === alice.userId
          ? { userId: bob.userId, email: bob.email }
          : { userId: alice.userId, email: alice.email };
      const quotaKey = randomUUID();
      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: A,
            eventId: eventA,
            actorUserId: other.userId,
            actorEmail: other.email,
            emailVerified: true,
            rawCode: 'SECOND-CODE',
            idempotencyKey: quotaKey,
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );

      // Same-key replay of QUOTA_EXHAUSTED must not create a second op/ticket.
      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: A,
            eventId: eventA,
            actorUserId: other.userId,
            actorEmail: other.email,
            emailVerified: true,
            rawCode: 'SECOND-CODE',
            idempotencyKey: quotaKey,
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );
      const quotaOps = await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM operations
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
            AND actor_user_id = ${other.userId}::uuid
            AND client_key = ${quotaKey}
        `;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${A}::uuid AND event_id = ${eventA}::uuid
        `;
        return { ops: rows[0].n, tickets: tickets[0].n };
      });
      assert.equal(quotaOps.ops, 1);
      assert.equal(quotaOps.tickets, 1);

      await withTenant(db, A, async (tx) => {
        await tx.event.create({
          data: {
            tenantId: A,
            id: eventMail,
            slug: 'mail',
            name: 'Mail',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId: A,
          eventId: eventMail,
          eventQuota: 2,
          rawCodes: ['MAIL-CODE'],
        });
      });

      const mailIssue = await redeemOutsideTx(db, {
        tenantId: A,
        eventId: eventMail,
        actorUserId: alice.userId,
        actorEmail: alice.email,
        emailVerified: true,
        rawCode: 'MAIL-CODE',
        idempotencyKey: randomUUID(),
      });

      const failRelay = await relayOutboxOnce(
        db,
        createFailingEmailAdapter('smtp down'),
        'test-relay-fail',
        10,
      );
      assert.ok(failRelay.failed >= 1);

      const ticketState = await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT state FROM tickets WHERE id = ${mailIssue.ticketId}::uuid
        `;
        return rows[0].state;
      });
      assert.equal(ticketState, 'ACTIVE');

      const outboxAfterFail = await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE aggregate_id = ${mailIssue.ticketId}::uuid
        `;
        return rows[0].status;
      });
      assert.equal(outboxAfterFail, 'PENDING');

      const okRelay = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'test-relay-ok',
        10,
      );
      assert.ok(okRelay.completed >= 1);

      const outboxDone = await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE aggregate_id = ${mailIssue.ticketId}::uuid
        `;
        return rows[0].status;
      });
      assert.equal(outboxDone, 'COMPLETE');

      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: A,
            eventId: eventA,
            actorUserId: alice.userId,
            actorEmail: alice.email,
            emailVerified: true,
            rawCode: 'OTHER-TENANT-CODE',
            idempotencyKey: randomUUID(),
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.CODE_INVALID,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (db2) await db2.$disconnect().catch(() => {});
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

test(
  'issue: terminal QUOTA_EXHAUSTED is durable and replays after capacity change',
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
        subject: 'alice-quota',
        email: 'alice-quota@example.com',
        emailVerified: true,
      });
      const bob = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'bob-quota',
        email: 'bob-quota@example.com',
        emailVerified: true,
      });

      const T = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const eventId = '11111111-1111-4111-8111-111111111111';
      await seedTenantEvent(db, T, eventId, 'quota-durability');

      await withTenant(db, T, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: T,
          eventId,
          eventQuota: 1,
          rawCodes: ['SEAT-ONE', 'SEAT-TWO'],
        });
      });

      const win = await redeemOutsideTx(db, {
        tenantId: T,
        eventId,
        actorUserId: alice.userId,
        actorEmail: alice.email,
        emailVerified: true,
        rawCode: 'SEAT-ONE',
        idempotencyKey: randomUUID(),
      });
      assert.equal(win.replayed, false);

      const rejectKey = randomUUID();
      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: T,
            eventId,
            actorUserId: bob.userId,
            actorEmail: bob.email,
            emailVerified: true,
            rawCode: 'SEAT-TWO',
            idempotencyKey: rejectKey,
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );

      const beforeBump = await withTenant(db, T, async (tx) => {
        const ops = await tx.$queryRaw`
          SELECT status, response_json FROM operations
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
            AND actor_user_id = ${bob.userId}::uuid
            AND client_key = ${rejectKey}
        `;
        const quotas = await tx.$queryRaw`
          SELECT scope, capacity, allocated FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        const opRow = await getOperationForActor(tx, {
          tenantId: T,
          eventId,
          actorUserId: bob.userId,
          command: REDEEM_COMMAND,
          clientKey: rejectKey,
        });
        return { ops, quotas, tickets: tickets[0].n, outbox: outbox[0].n, opRow };
      });

      assert.equal(beforeBump.ops.length, 1, 'rejection op must survive commit');
      assert.equal(beforeBump.ops[0].status, 'COMPLETED');
      assert.equal(
        beforeBump.ops[0].response_json.code,
        ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );
      assert.ok(beforeBump.opRow);
      assert.equal(beforeBump.opRow.status, 'COMPLETED');
      assert.equal(
        beforeBump.opRow.response.code,
        ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );
      assert.equal(beforeBump.tickets, 1);
      assert.equal(beforeBump.outbox, 1);
      for (const q of beforeBump.quotas) {
        if (q.capacity !== null) assert.equal(Number(q.allocated), 1);
      }

      // Policy/capacity later changes must NOT re-run business for same key.
      await withTenant(db, T, async (tx) => {
        await tx.$executeRaw`
          UPDATE quota_buckets
          SET capacity = 10, updated_at = now()
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
      });

      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: T,
            eventId,
            actorUserId: bob.userId,
            actorEmail: bob.email,
            emailVerified: true,
            rawCode: 'SEAT-TWO',
            idempotencyKey: rejectKey,
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
      );

      const afterReplay = await withTenant(db, T, async (tx) => {
        const ops = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM operations
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
            AND actor_user_id = ${bob.userId}::uuid
            AND client_key = ${rejectKey}
        `;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        const quotas = await tx.$queryRaw`
          SELECT MAX(allocated)::int AS allocated FROM quota_buckets
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        const codes = await tx.$queryRaw`
          SELECT status FROM redemption_codes
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
          ORDER BY status
        `;
        const outbox = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${T}::uuid AND event_id = ${eventId}::uuid
        `;
        return {
          ops: ops[0].n,
          tickets: tickets[0].n,
          allocated: quotas[0].allocated,
          codes: codes.map((c) => c.status),
          outbox: outbox[0].n,
        };
      });

      assert.equal(afterReplay.ops, 1);
      assert.equal(afterReplay.tickets, 1);
      assert.equal(afterReplay.allocated, 1);
      assert.equal(afterReplay.outbox, 1);
      assert.deepEqual(afterReplay.codes.sort(), ['AVAILABLE', 'CONSUMED']);

      // Different key after capacity bump may succeed (no duplicate from reject key).
      const later = await redeemOutsideTx(db, {
        tenantId: T,
        eventId,
        actorUserId: bob.userId,
        actorEmail: bob.email,
        emailVerified: true,
        rawCode: 'SEAT-TWO',
        idempotencyKey: randomUUID(),
      });
      assert.equal(later.replayed, false);
      assert.notEqual(later.ticketId, win.ticketId);

      // Retryable conflict path must not leave a durable success op.
      // Force claim failure by using an empty key → IDEMPOTENCY_KEY_REQUIRED
      // (pre-claim throw). Separately, IN_PROGRESS without COMPLETE must roll back
      // on retryable throw: simulate via concurrent same-key where second sees
      // COMPLETED success and returns issued (not retryable durable success).
      await assert.rejects(
        () =>
          redeemOutsideTx(db, {
            tenantId: T,
            eventId,
            actorUserId: bob.userId,
            actorEmail: bob.email,
            emailVerified: true,
            rawCode: 'SEAT-TWO',
            idempotencyKey: 'not-a-uuid',
          }),
        (error) =>
          error instanceof IssueError &&
          error.code === ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      );
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
