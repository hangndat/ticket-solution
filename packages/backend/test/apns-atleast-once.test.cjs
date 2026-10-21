/**
 * Issue #652 — APNs TicketIssued at-least-once: retry after simulated crash
 * between provider send and DB ack must not lose push; duplicate send at most once
 * per device until notification is ACCEPTED.
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
  publishNotificationTemplate,
  publishEventConfig,
  saveEventConfigVersion,
  DEFAULT_TICKET_ISSUED_TEMPLATE,
  registerDeviceToken,
  createNoopEmailAdapter,
} = require('../dist');

const TASK_LABEL = 'task_5228eb044e35';

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
  const name = 'ticket-apns-atleast-once-' + randomBytes(4).toString('hex');
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
    'POSTGRES_DB=apns_atleast_once_test',
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
        'apns_atleast_once_test',
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
      '/apns_atleast_once_test',
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
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      "ALTER DATABASE apns_atleast_once_test SET app.tenant_id TO ''",
    );
  } finally {
    await admin.end().catch(() => {});
  }
  const url =
    'postgresql://postgres:' +
    password +
    '@127.0.0.1:' +
    port +
    '/apns_atleast_once_test';
  return { name, url };
}

function countingApnsAdapter() {
  let sends = 0;
  return {
    adapter: {
      async send() {
        sends += 1;
        return {
          ok: true,
          providerStatus: 'ACCEPTED',
          providerRef: `mock:push:${sends}`,
          resolvedEnvironment: 'sandbox',
        };
      },
    },
    getSends: () => sends,
  };
}

async function seedTicketIssuedFixture(db, HMAC, CREDENTIAL_KEY) {
  const users = createPrismaIdentityUserRepository(db);
  const owner = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'apns-atleast-once-owner',
    email: 'owner-apns-652@example.com',
    emailVerified: true,
  });
  const staff = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'apns-atleast-once-staff',
    email: 'staff-apns-652@example.com',
    emailVerified: true,
  });

  const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'apns-652', name: 'APNs 652' },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug: 'apns-event',
        name: 'APNs Event',
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
      rawCodes: ['APNS-652-1'],
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
        rawCode: 'APNS-652-1',
        idempotencyKey: randomUUID(),
        termsVersion: 'terms-v1',
        termsAccepted: true,
      }),
    ),
  );

  await registerDeviceToken(db, {
    userId: owner.userId,
    token: 'apns-atleast-once-device-token',
    environment: 'sandbox',
  });

  return { tenantId, eventId, ticketId: issued.ticketId, ownerUserId: owner.userId };
}

test(
  'APNs TicketIssued: retry after simulated crash between send and ack — at-most-one duplicate',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);

      const HMAC = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-652-pepper!!!!!!',
        CODE_HMAC_VERSION: '1',
      });
      const CREDENTIAL_KEY = 'apns-652-credential-key';

      const { tenantId, eventId, ticketId } = await seedTicketIssuedFixture(
        db,
        HMAC,
        CREDENTIAL_KEY,
      );

      const apns = countingApnsAdapter();
      const relayOpts = {
        credentialKeyMaterial: CREDENTIAL_KEY,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns: apns.adapter,
      };

      const first = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-apns-652-1',
        10,
        relayOpts,
      );
      assert.ok(first.completed >= 1);
      assert.equal(apns.getSends(), 1);

      const pushKeyRow = await withTenant(db, tenantId, async (tx) => {
        const push = await tx.$queryRaw`
          SELECT business_key, state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND channel = 'push'
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:push:%'}
        `;
        assert.equal(push[0]?.state, 'ACCEPTED');
        const outbox = await tx.$queryRaw`
          SELECT id, status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${ticketId}::uuid
            AND type = 'TicketIssued'
        `;
        assert.equal(outbox[0]?.status, 'COMPLETE');
        return { pushKey: push[0].business_key, outboxId: outbox[0].id };
      });

      const emailBusinessKey = 'ticket:' + ticketId + ':issued:email';
      // Simulate crash after APNs delivery but before push ack: push stays PENDING.
      // Re-enter push path on retry (email must not short-circuit to COMPLETE).
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE notifications
          SET state = 'PENDING',
              provider_ref = NULL,
              lease_owner = NULL,
              lease_token = NULL,
              lease_expires_at = NULL,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${pushKeyRow.pushKey}
        `;
        await tx.$executeRaw`
          UPDATE notifications
          SET state = 'PENDING',
              provider_ref = NULL,
              lease_owner = NULL,
              lease_token = NULL,
              lease_expires_at = NULL,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${emailBusinessKey}
            AND channel = 'email'
        `;
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'PENDING',
              lease_owner = NULL,
              lease_token = NULL,
              lease_expires_at = NULL,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${pushKeyRow.outboxId}::uuid
        `;
      });

      const second = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-apns-652-2',
        10,
        relayOpts,
      );
      assert.ok(second.completed >= 1);
      assert.equal(
        apns.getSends(),
        2,
        'retry must deliver push again when ack was lost (at-least-once)',
      );

      await withTenant(db, tenantId, async (tx) => {
        const push = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${pushKeyRow.pushKey}
        `;
        assert.equal(push[0]?.state, 'ACCEPTED');
      });

      const retryLeaseToken = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'LEASED',
              lease_owner = 'worker-apns-652-3',
              lease_token = ${retryLeaseToken},
              lease_expires_at = clock_timestamp() + interval '60 seconds',
              attempts = 2,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${pushKeyRow.outboxId}::uuid
        `;
      });

      const row = {
        outbox_id: pushKeyRow.outboxId,
        tenant_id: tenantId,
        event_id: eventId,
        type: 'TicketIssued',
        aggregate_id: ticketId,
        payload_version: 1,
        lease_token: retryLeaseToken,
        attempts: 2,
      };

      const third = await processClaimedOutbox(
        db,
        createNoopEmailAdapter(),
        [row],
        { ...relayOpts, leaseOwner: 'worker-apns-652-3' },
      );
      assert.equal(third.completed, 1);
      assert.equal(
        apns.getSends(),
        2,
        'must not call APNs again when push notification already ACCEPTED',
      );
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'APNs TicketIssued: provider throw before ack leaves PENDING — recovery still sends',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);

      const HMAC = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-652-pepper-b!!!!!',
        CODE_HMAC_VERSION: '1',
      });
      const CREDENTIAL_KEY = 'apns-652-credential-key-b';

      const { tenantId, ticketId } = await seedTicketIssuedFixture(
        db,
        HMAC,
        CREDENTIAL_KEY,
      );

      let sends = 0;
      const flakyApns = {
        async send() {
          sends += 1;
          if (sends === 1) {
            throw new Error('simulated_crash_before_ack');
          }
          return {
            ok: true,
            providerStatus: 'ACCEPTED',
            providerRef: 'mock:push:recovery',
            resolvedEnvironment: 'sandbox',
          };
        },
      };

      const relayOpts = {
        credentialKeyMaterial: CREDENTIAL_KEY,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test', NOTIFICATION_MAX_ATTEMPTS: '5' },
        apns: flakyApns,
        retryConfig: { maxAttempts: 5, baseSeconds: 0, maxSeconds: 0 },
      };

      const first = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-apns-652-flaky-1',
        10,
        relayOpts,
      );
      assert.ok(first.failed >= 1 || first.completed === 0);

      const second = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-apns-652-flaky-2',
        10,
        relayOpts,
      );
      assert.ok(second.completed >= 1);
      assert.equal(sends, 2);
      assert.ok(sends <= 2, 'at most one extra send on recovery');

      await withTenant(db, tenantId, async (tx) => {
        const push = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND channel = 'push'
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:push:%'}
        `;
        assert.equal(push[0]?.state, 'ACCEPTED');
      });
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);
