const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  bootstrapPlatformOperator,
  provisionTenant,
  acceptMembershipInvite,
  setTenantStatus,
  createMembershipInvite,
  revokeMembershipKeepingLastOwner,
  createAccountDeletionRequest,
  getCurrentAccountDeletionRequest,
  createSupportGrant,
  listSupportTickets,
  listMyTenants,
  readPlatformSecurityConfig,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  seedEventInventory,
  readCodeHmacEnvironment,
  withTenant,
  createEvent,
  grantMembership,
  grantEventAssignment,
  PLATFORM_ERROR_CODES,
  AuthzError,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name, 'migration.sql'));
}

async function startIsolatedPostgres() {
  const name = 'ticket-platform-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=platform_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'platform_test');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready);
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/platform_test',
  });
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
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE plat_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO plat_login');
  await admin.query('GRANT ticket_platform_runtime TO plat_login');
  await admin.end();
  return {
    name,
    url: 'postgresql://plat_login:' + password + '@127.0.0.1:' + port + '/platform_test',
  };
}

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'platform-test-pepper!!!!',
  CODE_HMAC_VERSION: '1',
});
const CRED = 'platform-credential-key';

test(
  'platform provision/invite/suspend/support/deletion acceptance',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);
      const users = createPrismaIdentityUserRepository(db);
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });

      const operator = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'operator-1',
        email: 'op@example.com',
        emailVerified: true,
      });
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-1',
        email: 'owner@example.com',
        emailVerified: true,
      });
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'mgr-1',
        email: 'mgr@example.com',
        emailVerified: true,
      });
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'att-1',
        email: 'att@example.com',
        emailVerified: true,
      });

      // Bootstrap once
      await bootstrapPlatformOperator(db, { userId: operator.userId });
      await assert.rejects(
        () => bootstrapPlatformOperator(db, { userId: operator.userId }),
        (e) => e.code === PLATFORM_ERROR_CODES.BOOTSTRAP_ALREADY_DONE,
      );

      // Provision tenant A
      const provisioned = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-1',
        body: {
          slug: 'tenant-a',
          name: 'Tenant A',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner@example.com',
          limits: {
            maxEvents: 2,
            maxStaff: 5,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      assert.equal(provisioned.status, 'PENDING');
      assert.ok(provisioned.rawInviteToken);

      // Replay idempotency
      const replay = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-1',
        body: {
          slug: 'tenant-a',
          name: 'Tenant A',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner@example.com',
          limits: {
            maxEvents: 2,
            maxStaff: 5,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      assert.equal(replay.tenantId, provisioned.tenantId);

      // Owner accept → ACTIVE
      const accepted = await acceptMembershipInvite(db, {
        userId: owner.userId,
        email: 'owner@example.com',
        emailVerified: true,
        token: provisioned.rawInviteToken,
      });
      assert.equal(accepted.tenantId, provisioned.tenantId);
      assert.equal(accepted.status, 'ACTIVE');

      const mine = await listMyTenants(db, owner.userId);
      assert.ok(mine.some((t) => t.tenantId === provisioned.tenantId));

      // Wrong email accept fails
      await assert.rejects(
        () =>
          acceptMembershipInvite(db, {
            userId: manager.userId,
            email: 'mgr@example.com',
            emailVerified: true,
            token: provisioned.rawInviteToken,
          }),
        (e) =>
          e.code === PLATFORM_ERROR_CODES.INVITE_ALREADY_USED ||
          e.code === PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
      );

      // Invite manager
      const inv = await createMembershipInvite(db, security, {
        tenantId: provisioned.tenantId,
        actorUserId: owner.userId,
        email: 'mgr@example.com',
        role: 'Manager',
        clientKey: 'inv-mgr',
      });
      const mgrAccept = await acceptMembershipInvite(db, {
        userId: manager.userId,
        email: 'mgr@example.com',
        emailVerified: true,
        token: inv.rawToken,
      });
      assert.equal(mgrAccept.tenantId, provisioned.tenantId);

      // Create event under limits
      let eventId;
      await withTenant(db, provisioned.tenantId, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: provisioned.tenantId,
          actorUserId: owner.userId,
          clientKey: 'evt-1',
          slug: 'fest',
          name: 'Fest',
        });
        eventId = ev.eventId;
        await seedEventInventory(tx, HMAC, {
          tenantId: provisioned.tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['CODE-P1'],
        });
      });

      // Suspend blocks new issue
      await setTenantStatus(db, {
        actorUserId: operator.userId,
        tenantId: provisioned.tenantId,
        status: 'SUSPENDED',
        reason: 'ops freeze',
        expectedVersion: 1,
      });
      await assert.rejects(
        () =>
          withTenant(db, provisioned.tenantId, (tx) =>
            redeemAndIssueTicket(tx, HMAC, CRED, {
              tenantId: provisioned.tenantId,
              eventId,
              actorUserId: attendee.userId,
              actorEmail: 'att@example.com',
              emailVerified: true,
              rawCode: 'CODE-P1',
              idempotencyKey: randomUUID(),
            }),
          ),
        (e) => e.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED,
      );

      // Resume and issue
      await setTenantStatus(db, {
        actorUserId: operator.userId,
        tenantId: provisioned.tenantId,
        status: 'ACTIVE',
        reason: 'resume',
        expectedVersion: 2,
      });
      const issued = await withTenant(db, provisioned.tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, {
          tenantId: provisioned.tenantId,
          eventId,
          actorUserId: attendee.userId,
          actorEmail: 'att@example.com',
          emailVerified: true,
          rawCode: 'CODE-P1',
          idempotencyKey: randomUUID(),
        }),
      );
      const ticket = unwrapRedeemOutcome(issued);
      assert.ok(ticket.ticketId);

      // Support grant read-only
      const grant = await createSupportGrant(db, security, {
        actorUserId: operator.userId,
        tenantId: provisioned.tenantId,
        eventId,
        scopes: ['cs.read'],
        reason: 'incident review',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      const supportRows = await listSupportTickets(db, {
        actorUserId: operator.userId,
        grantId: grant.grantId,
      });
      assert.ok(supportRows.length >= 1);
      assert.ok(!JSON.stringify(supportRows).includes('att@example.com'));

      // Last owner cannot revoke self
      await assert.rejects(
        () =>
          revokeMembershipKeepingLastOwner(db, {
            tenantId: provisioned.tenantId,
            actorUserId: owner.userId,
            membershipId: accepted.membershipId,
            reason: 'leave',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
      );

      // Account deletion ACK only
      const del = await createAccountDeletionRequest(db, {
        userId: attendee.userId,
        confirmation: true,
      });
      assert.equal(del.state, 'AWAITING_POLICY');
      assert.equal(del.policyStatus, 'UNRESOLVED');
      const again = await createAccountDeletionRequest(db, {
        userId: attendee.userId,
        confirmation: true,
      });
      assert.equal(again.requestId, del.requestId);
      const cur = await getCurrentAccountDeletionRequest(db, attendee.userId);
      assert.equal(cur.requestId, del.requestId);
      // User row still exists
      const still = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'att-1',
        email: 'att@example.com',
        emailVerified: true,
      });
      assert.equal(still.userId, attendee.userId);

      // Future activated_at deny
      await withTenant(db, provisioned.tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE memberships
          SET activated_at = now() + interval '1 day'
          WHERE tenant_id = ${provisioned.tenantId}::uuid
            AND user_id = ${manager.userId}::uuid
        `;
      });
      await assert.rejects(
        () =>
          withTenant(db, provisioned.tenantId, (tx) =>
            createEvent(tx, {
              tenantId: provisioned.tenantId,
              actorUserId: manager.userId,
              clientKey: 'evt-future',
              slug: 'nope',
              name: 'Nope',
            }),
          ),
        (e) => e instanceof AuthzError,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          // ignore
        }
      }
    }
  },
);
