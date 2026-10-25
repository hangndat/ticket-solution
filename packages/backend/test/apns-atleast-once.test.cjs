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

  return {
    tenantId,
    eventId,
    ticketId: issued.ticketId,
    ownerUserId: owner.userId,
  };
}

test(
  'F02: expired worker lease recovers unacked push without resetting ACCEPTED email',
  { timeout: 240000, skip: !dockerAvailable() },
  async (t) => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'atlas-f02-fixture-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKeyMaterial = 'atlas-f02-fixture-credential';
      const { tenantId, ticketId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKeyMaterial,
      );
      const apns = countingApnsAdapter();
      const email = createNoopEmailAdapter();
      const sendEmail = email.sendTicketIssued.bind(email);
      let emailSends = 0;
      email.sendTicketIssued = async (message) => {
        emailSends += 1;
        return sendEmail(message);
      };
      const options = {
        credentialKeyMaterial,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns: apns.adapter,
      };
      const first = await relayOutboxOnce(
        db,
        email,
        'atlas-f02-before',
        10,
        options,
      );
      assert.equal(first.completed, 1);
      assert.equal(emailSends, 1);
      assert.equal(apns.getSends(), 1);

      // Inject only the durable state left by a hard process death after APNs
      // accepted the send but before its DB ack. Do NOT undo the earlier email
      // commit, and do NOT call the graceful exception/retry handler.
      await withTenant(db, tenantId, async (tx) => {
        const emailRows = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + ticketId + ':issued:email'}
        `;
        assert.equal(emailRows[0]?.state, 'ACCEPTED');
        const changed = await tx.$executeRaw`
          UPDATE notifications SET state = 'PENDING', provider_ref = NULL
          WHERE tenant_id = ${tenantId}::uuid AND channel = 'push'
        `;
        assert.equal(Number(changed), 1);
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'PROCESSING', lease_owner = 'atlas-f02-crashed',
              lease_token = ${randomUUID()}::uuid,
              lease_expires_at = clock_timestamp() - interval '1 second',
              next_attempt_at = NULL
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${ticketId}::uuid AND type = 'TicketIssued'
        `;
      });

      const recovered = await relayOutboxOnce(
        db,
        email,
        'atlas-f02-recovery',
        10,
        options,
      );
      assert.equal(
        recovered.claimed,
        1,
        'expired PROCESSING lease must be reclaimed',
      );
      const states = await withTenant(db, tenantId, async (tx) => {
        const notifications = await tx.$queryRaw`
          SELECT channel, state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid ORDER BY channel
        `;
        const outbox = await tx.$queryRaw`
          SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${ticketId}::uuid AND type = 'TicketIssued'
        `;
        return { notifications, outboxStatus: outbox[0]?.status };
      });
      const actual = { emailSends, pushSends: apns.getSends(), ...states };
      t.diagnostic(JSON.stringify(actual));
      assert.deepEqual(
        actual,
        {
          emailSends: 1,
          pushSends: 2,
          notifications: [
            { channel: 'email', state: 'ACCEPTED' },
            { channel: 'push', state: 'ACCEPTED' },
          ],
          outboxStatus: 'COMPLETE',
        },
        'recovery must finish push while preserving the committed email ack',
      );
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

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
        retryConfig: {
          maxAttempts: 5,
          initialBackoffSeconds: 1,
          maxBackoffSeconds: 1,
          jitterRatio: 0,
        },
      };

      const first = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-apns-652-flaky-1',
        10,
        relayOpts,
      );
      assert.ok(first.failed >= 1 || first.completed === 0);

      await new Promise((resolve) => setTimeout(resolve, 1100));

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

test(
  'TicketIssued: partial device failure retries only the failed push, never accepted email/device',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-multidevice-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKey = 'apns-multidevice-credential';
      const { tenantId, ticketId, ownerUserId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKey,
      );
      await registerDeviceToken(db, {
        userId: ownerUserId,
        token: 'apns-multidevice-second-token-123456',
        environment: 'sandbox',
      });
      let emailSends = 0;
      const baseEmail = createNoopEmailAdapter();
      const email = {
        ...baseEmail,
        async sendTicketIssued(payload) {
          emailSends += 1;
          return baseEmail.sendTicketIssued(payload);
        },
      };
      const pushedTokens = [];
      const apns = {
        async send(input) {
          pushedTokens.push(input.deviceToken);
          if (pushedTokens.length === 2) {
            return {
              ok: false,
              providerStatus: 'FAILED',
              reason: 'temporary',
              invalidateToken: false,
              retryable: true,
            };
          }
          return {
            ok: true,
            providerStatus: 'ACCEPTED',
            providerRef: 'mock:push:' + pushedTokens.length,
            resolvedEnvironment: 'sandbox',
          };
        },
      };
      const opts = {
        credentialKeyMaterial: credentialKey,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns,
        retryConfig: {
          maxAttempts: 3,
          initialBackoffSeconds: 1,
          maxBackoffSeconds: 1,
          jitterRatio: 0,
        },
      };
      const first = await relayOutboxOnce(
        db,
        email,
        'worker-multi-1',
        10,
        opts,
      );
      assert.equal(first.completed, 0);
      await withTenant(db, tenantId, async (tx) => {
        const notes = await tx.$queryRaw`
          SELECT channel, state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:%'}
        `;
        assert.deepEqual(notes.map((item) => item.state).sort(), [
          'ACCEPTED',
          'ACCEPTED',
          'FAILED',
        ]);
      });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const second = await relayOutboxOnce(
        db,
        email,
        'worker-multi-2',
        10,
        opts,
      );
      assert.equal(second.completed, 1);
      assert.equal(emailSends, 1);
      assert.equal(pushedTokens.length, 3);
      assert.equal(pushedTokens[2], pushedTokens[1]);
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'TicketIssued: reclaimed lease rejects stale APNs ack and completion',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-stale-lease-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKey = 'apns-stale-lease-credential';
      const { tenantId, eventId, ticketId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKey,
      );
      const outboxId = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id FROM outbox WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${ticketId}::uuid AND type = 'TicketIssued'
        `;
        return rows[0].id;
      });
      const newToken = randomUUID();
      let sends = 0;
      const apns = {
        async send() {
          sends += 1;
          if (sends === 1) {
            await withTenant(db, tenantId, async (tx) => {
              await tx.$executeRaw`
                UPDATE outbox SET status = 'LEASED', lease_owner = 'worker-new',
                  lease_token = ${newToken},
                  lease_expires_at = clock_timestamp() + interval '60 seconds',
                  attempts = attempts + 1
                WHERE tenant_id = ${tenantId}::uuid AND id = ${outboxId}::uuid
              `;
            });
          }
          return {
            ok: true,
            providerStatus: 'ACCEPTED',
            providerRef: 'mock:stale:' + sends,
            resolvedEnvironment: 'sandbox',
          };
        },
      };
      const opts = {
        credentialKeyMaterial: credentialKey,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns,
      };
      const first = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-old',
        10,
        opts,
      );
      assert.equal(first.completed, 0);
      await withTenant(db, tenantId, async (tx) => {
        const push = await tx.$queryRaw`
          SELECT state, attempts FROM notifications WHERE tenant_id = ${tenantId}::uuid
            AND channel = 'push' AND business_key LIKE ${'ticket:' + ticketId + ':issued:push:%'}
        `;
        assert.equal(push[0].state, 'PENDING');
        assert.equal(push[0].attempts, 0);
      });
      const second = await processClaimedOutbox(
        db,
        createNoopEmailAdapter(),
        [
          {
            outbox_id: outboxId,
            tenant_id: tenantId,
            event_id: eventId,
            type: 'TicketIssued',
            aggregate_id: ticketId,
            payload_version: 1,
            lease_token: newToken,
            attempts: 2,
          },
        ],
        { ...opts, leaseOwner: 'worker-new' },
      );
      assert.equal(second.completed, 1);
      assert.equal(sends, 2);
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'TicketIssued: legacy COMPLETE repair dry-run and apply requeue unacked push',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-legacy-repair-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKey = 'apns-legacy-repair-credential';
      const { tenantId, ticketId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKey,
      );
      const apns = countingApnsAdapter();
      const opts = {
        credentialKeyMaterial: credentialKey,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns: apns.adapter,
      };
      await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-legacy-1',
        10,
        opts,
      );
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET payload = payload - 'deliverySnapshot'
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${ticketId}::uuid
            AND type = 'TicketIssued'
        `;
        await tx.$executeRaw`
          UPDATE notifications SET state = 'PENDING', provider_ref = NULL
          WHERE tenant_id = ${tenantId}::uuid AND channel = 'push'
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:push:%'}
        `;
      });
      const script =
        require.resolve('../scripts/repair-ticket-issued-outbox.cjs');
      const runRepair = (...args) =>
        JSON.parse(
          execFileSync(
            process.execPath,
            [script, '--tenant', tenantId, ...args],
            {
              encoding: 'utf8',
              env: { ...process.env, DATABASE_URL: boot.url },
            },
          ),
        );
      assert.equal(runRepair().candidates, 1);
      assert.equal(runRepair('--apply').candidates, 1);
      assert.equal(runRepair().candidates, 0);
      const recovered = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-legacy-2',
        10,
        opts,
      );
      assert.equal(recovered.completed, 1);
      assert.equal(apns.getSends(), 2);
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'TicketIssued: process exits after APNs accept; reclaim resends the unacked push',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-process-exit-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKey = 'apns-process-exit-credential';
      const { tenantId, ticketId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKey,
      );
      const child = require.resolve('./fixtures/exit-after-apns.cjs');
      assert.throws(
        () =>
          execFileSync(process.execPath, [child], {
            encoding: 'utf8',
            env: {
              ...process.env,
              DATABASE_URL: boot.url,
              TEST_CREDENTIAL_KEY: credentialKey,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
        (error) =>
          error.status === 91 && error.stdout.includes('APNS_ACCEPTED'),
      );
      await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT channel, state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:%'}
        `;
        assert.deepEqual(rows.map((item) => item.state).sort(), [
          'ACCEPTED',
          'PENDING',
        ]);
        await tx.$executeRaw`
          UPDATE outbox SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${ticketId}::uuid
            AND type = 'TicketIssued'
        `;
      });
      const apns = countingApnsAdapter();
      const recovered = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-after-process-exit',
        10,
        {
          credentialKeyMaterial: credentialKey,
          publicWebBaseUrl: 'https://tickets.example.test',
          env: { NODE_ENV: 'test' },
          apns: apns.adapter,
        },
      );
      assert.equal(recovered.completed, 1);
      assert.equal(apns.getSends(), 1);
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);

test(
  'TicketIssued: revoked ticket after email ack preserves email state and stops push',
  { timeout: 240000, skip: !dockerAvailable() },
  async () => {
    let pgName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'apns-revoked-ticket-pepper',
        CODE_HMAC_VERSION: '1',
      });
      const credentialKey = 'apns-revoked-ticket-credential';
      const { tenantId, ticketId } = await seedTicketIssuedFixture(
        db,
        hmac,
        credentialKey,
      );
      const apns = countingApnsAdapter();
      const opts = {
        credentialKeyMaterial: credentialKey,
        publicWebBaseUrl: 'https://tickets.example.test',
        env: { NODE_ENV: 'test' },
        apns: apns.adapter,
      };
      await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-before-revoke',
        10,
        opts,
      );
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE tickets SET state = 'REVOKED'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE notifications SET state = 'PENDING', provider_ref = NULL
          WHERE tenant_id = ${tenantId}::uuid AND channel = 'push'
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:push:%'}
        `;
        await tx.$executeRaw`
          UPDATE outbox SET status = 'PENDING', next_attempt_at = now(),
            lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${ticketId}::uuid
            AND type = 'TicketIssued'
        `;
      });
      const result = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'worker-after-revoke',
        10,
        opts,
      );
      assert.equal(result.failed, 1);
      assert.equal(apns.getSends(), 1);
      await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT channel, state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key LIKE ${'ticket:' + ticketId + ':issued:%'}
        `;
        assert.deepEqual(
          rows.map((item) => [item.channel, item.state]).sort(),
          [
            ['email', 'ACCEPTED'],
            ['push', 'DEAD'],
          ],
        );
      });
    } finally {
      if (db) await db.$disconnect();
      if (pgName) docker('rm', '-f', '-v', pgName);
    }
  },
);
