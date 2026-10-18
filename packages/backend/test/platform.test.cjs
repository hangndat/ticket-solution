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
  getPlatformMe,
  provisionTenant,
  listPlatformTenants,
  acceptMembershipInvite,
  setTenantStatus,
  createMembershipInvite,
  revokeMembershipKeepingLastOwner,
  createAccountDeletionRequest,
  getCurrentAccountDeletionRequest,
  processDueAccountAnonymizations,
  createFakeKeycloakErasureAdapter,
  readTombstoneKeyring,
  IdentityError,
  IDENTITY_ERROR_CODES,
  O06_ACCOUNT_ANONYMIZE_POLICY_VERSION,
  O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
  createSupportGrant,
  revokeSupportGrant,
  getPlatformTenantHealth,
  listSupportTickets,
  listMyTenants,
  listMyEvents,
  readPlatformSecurityConfig,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  seedEventInventory,
  readCodeHmacEnvironment,
  withTenant,
  withPlatformRole,
  createEvent,
  grantMembership,
  grantEventAssignment,
  revokeEventAssignment,
  eventPermissionsForRole,
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
          idempotencyKey: randomUUID(),
          body: {
            slug: 'fest',
            name: 'Fest',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
        eventId = ev.event.eventId;
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

      const revoked = await revokeSupportGrant(db, {
        actorUserId: operator.userId,
        grantId: grant.grantId,
        reason: 'incident closed',
      });
      assert.equal(revoked.grantId, grant.grantId);
      assert.ok(revoked.revokedAt);
      await assert.rejects(
        () =>
          listSupportTickets(db, {
            actorUserId: operator.userId,
            grantId: grant.grantId,
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.PERMISSION_DENIED,
      );
      await assert.rejects(
        () =>
          revokeSupportGrant(db, {
            actorUserId: operator.userId,
            grantId: grant.grantId,
            reason: 'again',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      );

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

      // Account deletion ACK → O06 REQUESTED (anonymize ≤30d); no hard erase yet
      const del = await createAccountDeletionRequest(db, {
        userId: attendee.userId,
        confirmation: true,
      });
      assert.equal(del.state, 'REQUESTED');
      assert.equal(del.policyStatus, 'RESOLVED');
      assert.equal(del.anonymizeWithinDays, O06_ACCOUNT_ANONYMIZE_MAX_DAYS);
      const again = await createAccountDeletionRequest(db, {
        userId: attendee.userId,
        confirmation: true,
      });
      assert.equal(again.requestId, del.requestId);
      const cur = await getCurrentAccountDeletionRequest(db, attendee.userId);
      assert.equal(cur.requestId, del.requestId);
      assert.equal(cur.state, 'REQUESTED');
      assert.equal(cur.policyStatus, 'RESOLVED');

      // Audit rows must survive anonymize (TTL 730d — never hard-delete here)
      const auditBefore = await withTenant(db, provisioned.tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.ok(auditBefore[0].n >= 1, 'expected issue/support audit before anonymize');

      const delEnv = {
        OIDC_ISSUER: 'http://localhost/realms/ticket',
        ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k1',
        ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
          {
            keyId: 'k1',
            secretBase64: Buffer.alloc(32, 9).toString('base64'),
          },
        ]),
      };
      const delOpts = {
        env: delEnv,
        leaseOwner: 'platform-test',
        keyring: readTombstoneKeyring(delEnv),
        idp: createFakeKeycloakErasureAdapter({
          async deleteUserBySubject() {
            return { kind: 'DELETED' };
          },
        }),
      };
      const processed = await processDueAccountAnonymizations(db, 50, delOpts);
      assert.equal(processed.scanned, 1);
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 1);

      const after = await getCurrentAccountDeletionRequest(db, attendee.userId);
      assert.equal(after.state, 'COMPLETED');
      assert.equal(after.policyStatus, 'RESOLVED');

      const anonUser = await db.$queryRaw`
        SELECT email, email_verified, subject FROM users WHERE id = ${attendee.userId}::uuid
      `;
      assert.equal(anonUser[0].email, null);
      assert.equal(anonUser[0].email_verified, false);
      assert.equal(anonUser[0].subject, 'anon:' + del.requestId);

      const auditAfter = await withTenant(db, provisioned.tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.equal(auditAfter[0].n, auditBefore[0].n);

      // Idempotent second pass
      const againProc = await processDueAccountAnonymizations(db, 50, delOpts);
      assert.equal(againProc.applied, 0);
      assert.equal(againProc.completed, 0);

      // SEC-2: same OIDC (issuer,sub) blocked by tombstone digest within TTL
      const usersDenied = createPrismaIdentityUserRepository(db, { env: delEnv });
      await assert.rejects(
        () =>
          usersDenied.upsertFromVerifiedIdentity({
            issuer: 'http://localhost/realms/ticket',
            subject: 'att-1',
            email: 'att@example.com',
            emailVerified: true,
          }),
        (e) =>
          e instanceof IdentityError &&
          e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      );
      assert.ok(O06_ACCOUNT_ANONYMIZE_POLICY_VERSION.length > 0);

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
              idempotencyKey: randomUUID(),
              body: {
                slug: 'nope',
                name: 'Nope',
                timezone: 'Asia/Ho_Chi_Minh',
              },
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

test(
  'O02 MeEvents staffEligible + revoke fail-closed discovery',
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
        subject: 'op-me-events',
        email: 'op-me@example.com',
        emailVerified: true,
      });
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-me-events',
        email: 'owner-me@example.com',
        emailVerified: true,
      });
      const scanner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'scanner-me-events',
        email: 'scanner-me@example.com',
        emailVerified: true,
      });
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'att-me-events',
        email: 'att-me@example.com',
        emailVerified: true,
      });

      await bootstrapPlatformOperator(db, { userId: operator.userId });
      const provisioned = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'me-events-prov',
        body: {
          slug: 'me-events-tenant',
          name: 'Me Events Tenant',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-me@example.com',
          limits: {
            maxEvents: 5,
            maxStaff: 10,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      const accepted = await acceptMembershipInvite(db, {
        userId: owner.userId,
        email: 'owner-me@example.com',
        emailVerified: true,
        token: provisioned.rawInviteToken,
      });

      // Attendee-only → not staffEligible
      const attendeeDiscovery = await listMyEvents(db, attendee.userId);
      assert.equal(attendeeDiscovery.staffEligible, false);
      assert.deepEqual(attendeeDiscovery.items, []);

      // Owner membership, 0 assignments → eligible, empty items
      const ownerBeforeAssign = await listMyEvents(db, owner.userId);
      assert.equal(ownerBeforeAssign.staffEligible, true);
      assert.deepEqual(ownerBeforeAssign.items, []);

      let eventId;
      await withTenant(db, provisioned.tenantId, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: provisioned.tenantId,
          actorUserId: owner.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'gate-night',
            name: 'Gate Night',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
        eventId = ev.event.eventId;
      });

      // Invite Scanner with event assignment
      const inv = await createMembershipInvite(db, security, {
        tenantId: provisioned.tenantId,
        actorUserId: owner.userId,
        email: 'scanner-me@example.com',
        role: 'Scanner',
        eventAssignments: [{ eventId, role: 'Scanner' }],
        clientKey: 'me-events-scanner',
      });
      const scannerAccept = await acceptMembershipInvite(db, {
        userId: scanner.userId,
        email: 'scanner-me@example.com',
        emailVerified: true,
        token: inv.rawToken,
      });
      assert.equal(scannerAccept.tenantId, provisioned.tenantId);

      const scannerDiscovery = await listMyEvents(db, scanner.userId);
      assert.equal(scannerDiscovery.staffEligible, true);
      assert.equal(scannerDiscovery.items.length, 1);
      assert.equal(scannerDiscovery.items[0].tenantId, provisioned.tenantId);
      assert.equal(scannerDiscovery.items[0].eventId, eventId);
      assert.equal(scannerDiscovery.items[0].name, 'Gate Night');
      assert.ok(scannerDiscovery.items[0].permissions.includes('gate.confirm'));
      assert.deepEqual(
        scannerDiscovery.items[0].permissions,
        eventPermissionsForRole('Scanner'),
      );

      // Revoke assignment → item disappears; membership still → eligible
      let assignmentId;
      await withTenant(db, provisioned.tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id FROM event_assignments
          WHERE tenant_id = ${provisioned.tenantId}::uuid
            AND event_id = ${eventId}::uuid
            AND membership_id = ${scannerAccept.membershipId}::uuid
            AND revoked_at IS NULL
        `;
        assignmentId = rows[0].id;
        await revokeEventAssignment(tx, provisioned.tenantId, assignmentId);
      });
      const afterAssignRevoke = await listMyEvents(db, scanner.userId);
      assert.equal(afterAssignRevoke.staffEligible, true);
      assert.deepEqual(afterAssignRevoke.items, []);

      // Revoke membership → staffEligible false
      await revokeMembershipKeepingLastOwner(db, {
        tenantId: provisioned.tenantId,
        actorUserId: owner.userId,
        membershipId: scannerAccept.membershipId,
        reason: 'offboard',
      });
      const afterMemberRevoke = await listMyEvents(db, scanner.userId);
      assert.equal(afterMemberRevoke.staffEligible, false);
      assert.deepEqual(afterMemberRevoke.items, []);

      // Owner still eligible after creating event (assignment may exist for creator)
      const ownerAfter = await listMyEvents(db, owner.userId);
      assert.equal(ownerAfter.staffEligible, true);
      // Owner keep last-owner: membership still active
      void accepted;
      const ownerTenants = await listMyTenants(db, owner.userId);
      assert.ok(ownerTenants.some((t) => t.tenantId === provisioned.tenantId));
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

test(
  'platform tenants list cursor pagination (H-P1)',
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
        subject: 'op-list-1',
        email: 'op-list@example.com',
        emailVerified: true,
      });
      const stranger = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'stranger-list-1',
        email: 'stranger-list@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const tenantIds = [];
      for (let i = 0; i < 3; i++) {
        const slug = 'list-t' + i + '-' + randomBytes(2).toString('hex');
        const prov = await provisionTenant(db, security, {
          actorUserId: operator.userId,
          clientKey: 'list-prov-' + i,
          body: {
            slug,
            name: 'List Tenant ' + i,
            defaultTimezone: 'Asia/Ho_Chi_Minh',
            ownerEmail: 'owner-list-' + i + '@example.com',
            limits: {
              maxEvents: 1,
              maxStaff: 2,
              emailPerDay: null,
              importRowsPerJob: null,
            },
            flags: { importsEnabled: true, exportsEnabled: true },
          },
        });
        tenantIds.push(prov.tenantId);
      }
      tenantIds.sort();

      await assert.rejects(
        () =>
          listPlatformTenants(db, {
            actorUserId: stranger.userId,
            limit: 20,
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED,
      );

      await assert.rejects(
        () =>
          listPlatformTenants(db, {
            actorUserId: operator.userId,
            cursor: 'not-a-uuid',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );

      const page1 = await listPlatformTenants(db, {
        actorUserId: operator.userId,
        limit: 2,
      });
      assert.equal(page1.items.length, 2);
      assert.ok(page1.nextCursor);
      assert.deepEqual(
        page1.items.map((t) => t.tenantId),
        tenantIds.slice(0, 2),
      );
      for (const item of page1.items) {
        assert.ok(item.slug);
        assert.ok(item.name);
        assert.ok(['PENDING', 'ACTIVE', 'SUSPENDED'].includes(item.status));
        assert.equal(typeof item.version, 'number');
        assert.ok(item.createdAt);
      }

      const page2 = await listPlatformTenants(db, {
        actorUserId: operator.userId,
        cursor: page1.nextCursor,
        limit: 2,
      });
      assert.equal(page2.items.length, 1);
      assert.equal(page2.nextCursor, null);
      assert.equal(page2.items[0].tenantId, tenantIds[2]);

      const me = await getPlatformMe(db, operator.userId);
      assert.ok(me.permittedCommands.includes('platform.tenants.list'));
      assert.ok(me.permittedCommands.includes('platform.health.read'));
      assert.ok(me.permittedCommands.includes('platform.support.revoke'));
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
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
  'platform tenant health counters (H-P2) + support grant revoke audit',
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
        subject: 'op-health-1',
        email: 'op-health@example.com',
        emailVerified: true,
      });
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-health-1',
        email: 'owner-health@example.com',
        emailVerified: true,
      });
      const stranger = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'stranger-health-1',
        email: 'stranger-health@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const slug = 'health-' + randomBytes(3).toString('hex');
      const provisioned = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'health-prov-1',
        body: {
          slug,
          name: 'Health Tenant',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-health@example.com',
          limits: {
            maxEvents: 5,
            maxStaff: 5,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });

      await acceptMembershipInvite(db, {
        userId: owner.userId,
        email: 'owner-health@example.com',
        emailVerified: true,
        token: provisioned.rawInviteToken,
      });

      let eventId;
      await withTenant(db, provisioned.tenantId, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: provisioned.tenantId,
          actorUserId: owner.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'health-ev',
            name: 'Health Event',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
        eventId = ev.event.eventId;
      });

      const nPending = randomUUID();
      const nFailed = randomUUID();
      const nDead = randomUUID();
      const oPending = randomUUID();
      const oDead = randomUUID();
      await withTenant(db, provisioned.tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, state, kind,
            payload_version, attempts, payload, created_at, updated_at
          ) VALUES
            (
              ${provisioned.tenantId}::uuid, ${eventId}::uuid, ${nPending}::uuid,
              'health:pending', 'email', 'PENDING', 'TicketIssued', 1,
              0, '{}'::jsonb, now(), now()
            ),
            (
              ${provisioned.tenantId}::uuid, ${eventId}::uuid, ${nFailed}::uuid,
              'health:failed', 'email', 'FAILED', 'TicketIssued', 1,
              1, '{}'::jsonb, now(), now()
            ),
            (
              ${provisioned.tenantId}::uuid, ${eventId}::uuid, ${nDead}::uuid,
              'health:dead', 'email', 'DEAD', 'TicketIssued', 1,
              3, '{}'::jsonb, now(), now()
            )
        `;
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, created_at, updated_at
          ) VALUES
            (
              ${provisioned.tenantId}::uuid, ${eventId}::uuid, ${oPending}::uuid,
              'TicketIssued', ${nPending}::uuid, 1, '{}'::jsonb,
              'PENDING', 0, now(), now()
            ),
            (
              ${provisioned.tenantId}::uuid, ${eventId}::uuid, ${oDead}::uuid,
              'TicketIssued', ${nDead}::uuid, 1, '{}'::jsonb,
              'DEAD', 3, now(), now()
            )
        `;
      });

      await assert.rejects(
        () =>
          getPlatformTenantHealth(db, stranger.userId, provisioned.tenantId),
        (e) => e.code === PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED,
      );

      const health = await getPlatformTenantHealth(
        db,
        operator.userId,
        provisioned.tenantId,
      );
      assert.equal(health.tenantId, provisioned.tenantId);
      assert.ok(health.observedAt);
      assert.equal(health.notifications.pending, 1);
      assert.equal(health.notifications.failed, 1);
      assert.equal(health.notifications.dead, 1);
      // Provision enqueues owner-invite outbox; plus one seeded PENDING.
      assert.ok(health.outbox.pending >= 1);
      assert.equal(health.outbox.failed, 1);
      assert.ok(health.usage.events >= 1);
      const healthJson = JSON.stringify(health);
      assert.ok(!healthJson.includes('owner-health@example.com'));
      assert.ok(!/recipient|smtp|errorMessage/i.test(healthJson));

      const grant = await createSupportGrant(db, security, {
        actorUserId: operator.userId,
        tenantId: provisioned.tenantId,
        eventId,
        scopes: ['cs.read'],
        reason: 'health-check grant',
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      });
      await assert.rejects(
        () =>
          revokeSupportGrant(db, {
            actorUserId: operator.userId,
            grantId: grant.grantId,
            reason: '',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );
      const revoked = await revokeSupportGrant(db, {
        actorUserId: operator.userId,
        grantId: grant.grantId,
        reason: 'done',
      });
      assert.equal(revoked.grantId, grant.grantId);

      const rows = await withPlatformRole(db, async (tx) =>
        tx.$queryRaw`
          SELECT action
          FROM platform_audit_logs
          WHERE resource_id = ${grant.grantId}::uuid
            AND action = 'platform.support.revoked'
        `,
      );
      assert.equal(rows.length, 1);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
