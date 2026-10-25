/**
 * Issue #620 — outbox lease fence + provider outside DB tx (H2/H3).
 * DB isolation: Docker Postgres 18.1 (skipped when docker unavailable).
 */
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
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  processClaimedOutbox,
  relayOutboxOnce,
  claimOutboxBatch,
  collectWorkerDueJobSnapshot,
  metricsQuantileSeconds,
  resetMetricsForTests,
  publishNotificationTemplate,
  publishEventConfig,
  saveEventConfigVersion,
  DEFAULT_TICKET_ISSUED_TEMPLATE,
} = require('../dist');

const TASK_LABEL = 'task_9d8888fbc855';

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function dockerAvailable() {
  try {
    docker('info', '-f', '{{.ServerVersion}}');
    return true;
  } catch {
    return false;
  }
}

async function startIsolatedPostgres() {
  const name = 'ticket-outbox-fence-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=' + TASK_LABEL,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=outbox_fence_test',
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
        'outbox_fence_test',
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/outbox_fence_test',
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
    await admin.query(
      'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of migrationFiles()) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      'REVOKE ALL ON public.worker_job_reclaim_counters FROM ticket_runtime',
    );
    await admin.query(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      "ALTER DATABASE outbox_fence_test SET app.tenant_id TO ''",
    );
  } finally {
    await admin.end().catch(() => {});
  }
  const url =
    'postgresql://postgres:' +
    password +
    '@127.0.0.1:' +
    port +
    '/outbox_fence_test';
  return { name, url };
}

function countingInviteEmailAdapter() {
  let inviteSends = 0;
  return {
    adapter: {
      async sendTicketIssued() {
        throw new Error('not used');
      },
      async sendMembershipInvite() {
        inviteSends += 1;
        return { providerRef: 'mock:invite', providerStatus: 'ACCEPTED' };
      },
      async sendGuestInvitation() {
        throw new Error('not used');
      },
    },
    getInviteSends: () => inviteSends,
  };
}

function countingTicketEmailAdapter() {
  let ticketSends = 0;
  return {
    adapter: {
      async sendTicketIssued() {
        ticketSends += 1;
        return { providerRef: 'mock:ticket', providerStatus: 'ACCEPTED' };
      },
      async sendMembershipInvite() {
        throw new Error('not used');
      },
      async sendGuestInvitation() {
        throw new Error('not used');
      },
    },
    getTicketSends: () => ticketSends,
  };
}

test(
  'outbox fence: MembershipInvite stale lease skips provider; winning worker sends once',
  { timeout: 180000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2, true);

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const outboxId = randomUUID();
      const inviteId = randomUUID();
      const leaseToken = 'lease-token-a';
      const email = 'invite-fence@example.com';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'fence-tenant', name: 'Fence Tenant' },
        });
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, lease_owner, lease_token,
            lease_expires_at, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, NULL, ${outboxId}::uuid,
            'MembershipInvite', ${inviteId}::uuid, 1,
            ${JSON.stringify({
              inviteId,
              email,
              role: 'manager',
              token: 'raw-invite-token',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            })}::jsonb,
            'LEASED', 0, 'worker-a', ${leaseToken},
            clock_timestamp() + interval '60 seconds', now(), now()
          )
        `;
      });

      const mock = countingInviteEmailAdapter();
      const row = {
        outbox_id: outboxId,
        tenant_id: tenantId,
        event_id: null,
        type: 'MembershipInvite',
        aggregate_id: inviteId,
        payload_version: 1,
        lease_token: leaseToken,
        attempts: 0,
      };

      const stale = await processClaimedOutbox(db, mock.adapter, [row], {
        credentialKeyMaterial: '',
        leaseOwner: 'worker-b',
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
      });
      assert.equal(mock.getInviteSends(), 0);
      assert.equal(stale.completed, 0);

      const ok = await processClaimedOutbox(db, mock.adapter, [row], {
        credentialKeyMaterial: '',
        leaseOwner: 'worker-a',
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
      });
      assert.equal(mock.getInviteSends(), 1);
      assert.equal(ok.completed, 1);

      const status = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid AND id = ${outboxId}::uuid
        `;
        return rows[0]?.status;
      });
      assert.equal(status, 'COMPLETE');

      const reclaimId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, lease_owner, lease_token,
            lease_expires_at, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, NULL, ${reclaimId}::uuid,
            'MembershipInvite', ${inviteId}::uuid, 1, '{}'::jsonb,
            'LEASED', 1, 'worker-dead', 'old-token',
            clock_timestamp() - interval '3 seconds',
            clock_timestamp() - interval '10 seconds', clock_timestamp()
          )
        `;
      });
      const due = await collectWorkerDueJobSnapshot(db);
      const before = due.find((row) => row.jobClass === 'relay_outbox');
      assert.equal(before.dueCount, 1);
      assert.ok(before.oldestDueAgeSeconds >= 2);
      assert.equal(before.reclaimCount, 0);
      const claimed = await claimOutboxBatch(db, 'worker-new', 1);
      assert.equal(claimed.length, 1);
      assert.equal(claimed[0].outbox_id, reclaimId);
      assert.notEqual(claimed[0].lease_token, 'old-token');
      const after = (await collectWorkerDueJobSnapshot(db)).find(
        (row) => row.jobClass === 'relay_outbox',
      );
      assert.equal(after.dueCount, 0);
      assert.equal(
        after.reclaimCount,
        1,
        'only an expired lease claim counts as reclaim',
      );
      const privilege = await db.$queryRaw`
        SELECT has_function_privilege('ticket_runtime', 'public.worker_due_job_snapshot()', 'EXECUTE') AS worker_can_probe,
               has_table_privilege('ticket_runtime', 'public.worker_job_reclaim_counters', 'SELECT') AS worker_can_read_counter
      `;
      assert.equal(privilege[0].worker_can_probe, true);
      assert.equal(privilege[0].worker_can_read_counter, false);
      const runtime = new Client({ connectionString: boot.url });
      await runtime.connect();
      try {
        await runtime.query('SET ROLE ticket_runtime');
        const visible = await runtime.query(
          'SELECT * FROM public.worker_due_job_snapshot()',
        );
        assert.equal(visible.rows.length, 5);
        assert.deepEqual(
          Object.keys(visible.rows[0]).sort(),
          [
            'job_class',
            'oldest_due_age_seconds',
            'due_count',
            'reclaim_count',
          ].sort(),
        );
        await assert.rejects(
          () =>
            runtime.query('SELECT * FROM public.worker_job_reclaim_counters'),
          /permission denied/i,
        );
        await assert.rejects(
          () => runtime.query("INSERT INTO public.worker_job_reclaim_counters(job_class,reclaim_count) VALUES('relay_outbox',999)"),
          /permission denied/i,
        );
        await assert.rejects(
          () => runtime.query("UPDATE public.worker_job_reclaim_counters SET reclaim_count=999 WHERE job_class='relay_outbox'"),
          /permission denied/i,
        );
        await runtime.query('RESET ROLE');
        await runtime.query('SET ROLE ticket_platform_runtime');
        await assert.rejects(
          () => runtime.query('SELECT * FROM public.worker_due_job_snapshot()'),
          /permission denied/i,
        );
      } finally {
        await runtime.end();
      }
      assert.deepEqual(
        Object.keys(due[0]).sort(),
        ['dueCount', 'jobClass', 'oldestDueAgeSeconds', 'reclaimCount'].sort(),
      );

      resetMetricsForTests();
      const tightPool = createDatabase(boot.url, 1, true);
      try {
        const slow = tightPool.$queryRaw`SELECT 1 AS n FROM pg_sleep(0.08)`;
        await new Promise((resolve) => setTimeout(resolve, 10));
        const waiting = tightPool.$queryRaw`SELECT 1`;
        await Promise.all([slow, waiting]);
        assert.ok(
          metricsQuantileSeconds('worker_db_pool_wait_seconds', {}, 1) > 0.04,
          'saturated one-connection pool must record actual acquisition wait',
        );
      } finally {
        await tightPool.$disconnect();
      }
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'TicketIssued: email outside tx — ACCEPTED notification prevents duplicate send on retry',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);

      const HMAC = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'outbox-fence-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      const CREDENTIAL_KEY = 'outbox-fence-credential-key-16b';

      const users = createPrismaIdentityUserRepository(db);
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'outbox-fence-owner',
        email: 'owner-fence@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'outbox-fence-staff',
        email: 'staff-fence@example.com',
        emailVerified: true,
      });

      const tenantId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'fence-t2', name: 'Fence T2' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'fence-event',
            name: 'Fence Event',
            status: 'DRAFT',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: ['event.config', 'event.publish', 'inventory.import'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['event.config', 'event.publish', 'inventory.import'],
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 3,
          rawCodes: ['FENCE-1'],
        });
        const saved = await saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          payload: {
            schemaVersion: 1,
            brand: { primaryColor: '#000', organizationName: 'Org' },
            sections: [
              {
                kind: 'hero',
                id: 'hero-1',
                visible: true,
                order: 0,
                body: { title: 'H', text: 'Hi' },
              },
              {
                kind: 'info',
                id: 'info-1',
                visible: true,
                order: 1,
                body: { title: 'I', text: 'Info' },
              },
              {
                kind: 'redeem',
                id: 'redeem-1',
                visible: true,
                order: 2,
                body: { title: 'R', text: 'Redeem' },
              },
              {
                kind: 'guide',
                id: 'guide-1',
                visible: true,
                order: 3,
                body: { title: 'G', text: 'Guide' },
              },
              {
                kind: 'faq',
                id: 'faq-1',
                visible: true,
                order: 4,
                body: {
                  title: 'FAQ',
                  items: [{ question: 'Q', answer: 'A' }],
                },
              },
              {
                kind: 'terms',
                id: 'terms-1',
                visible: true,
                order: 5,
                body: {
                  title: 'Terms',
                  termsVersion: 'terms-v1',
                  text: 'OK',
                },
              },
            ],
            termsVersion: 'terms-v1',
          },
        });
        await publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          expectedVersion: saved.version,
        });
        await publishNotificationTemplate(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          kind: 'TicketIssued',
          subject: DEFAULT_TICKET_ISSUED_TEMPLATE.subject,
          bodyText: DEFAULT_TICKET_ISSUED_TEMPLATE.bodyText,
          bodyHtml: DEFAULT_TICKET_ISSUED_TEMPLATE.bodyHtml,
        });
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
            tenantId,
            eventId,
            actorUserId: owner.userId,
            actorEmail: owner.email,
            emailVerified: true,
            rawCode: 'FENCE-1',
            idempotencyKey: randomUUID(),
            termsVersion: 'terms-v1',
            termsAccepted: true,
          }),
        ),
      );

      const mock = countingTicketEmailAdapter();
      const relayOpts = {
        credentialKeyMaterial: CREDENTIAL_KEY,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
      };

      const first = await relayOutboxOnce(
        db,
        mock.adapter,
        'worker-ticket-1',
        10,
        relayOpts,
      );
      assert.ok(first.completed >= 1, 'first relay must complete TicketIssued');
      assert.equal(mock.getTicketSends(), 1);

      const outboxRow = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id, status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${issued.ticketId}::uuid
            AND type = 'TicketIssued'
        `;
        const note = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + issued.ticketId + ':issued:email'}
        `;
        assert.equal(note[0]?.state, 'ACCEPTED');
        return rows[0];
      });
      assert.equal(outboxRow.status, 'COMPLETE');

      const retryLeaseToken = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'LEASED',
              lease_owner = 'worker-ticket-2',
              lease_token = ${retryLeaseToken},
              lease_expires_at = clock_timestamp() + interval '60 seconds',
              attempts = 1,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid AND id = ${outboxRow.id}::uuid
        `;
      });

      const row = {
        outbox_id: outboxRow.id,
        tenant_id: tenantId,
        event_id: eventId,
        type: 'TicketIssued',
        aggregate_id: issued.ticketId,
        payload_version: 1,
        lease_token: retryLeaseToken,
        attempts: 1,
      };

      const second = await processClaimedOutbox(db, mock.adapter, [row], {
        ...relayOpts,
        leaseOwner: 'worker-ticket-2',
      });
      assert.equal(second.completed, 1);
      assert.equal(
        mock.getTicketSends(),
        1,
        'must not call provider again when email notification already ACCEPTED',
      );
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);
