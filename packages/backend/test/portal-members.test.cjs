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
  createMembershipInvite,
  createEvent,
  listPortalMembers,
  listPortalInvites,
  changePortalMemberRole,
  putPortalEventAssignment,
  deletePortalEventAssignment,
  revokePortalInvite,
  resendPortalInvite,
  revokeMembershipKeepingLastOwner,
  readPlatformSecurityConfig,
  withTenant,
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
  const name = 'ticket-portal-members-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=portal_members_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
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
        'portal_members_test',
      );
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/portal_members_test',
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
  await admin.query(
    'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE pm_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO pm_login');
  await admin.query('GRANT ticket_platform_runtime TO pm_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://pm_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/portal_members_test',
  };
}

test(
  'portal members/invites list + role/assignment/revoke/resend (H-M1…H-M4)',
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
        subject: 'op-pm',
        email: 'op-pm@example.com',
        emailVerified: true,
      });
      const ownerA = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-a',
        email: 'owner-a@example.com',
        emailVerified: true,
      });
      const ownerB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-b',
        email: 'owner-b@example.com',
        emailVerified: true,
      });
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'mgr-pm',
        email: 'manager-pm@example.com',
        emailVerified: true,
      });
      const outsider = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'outsider-pm',
        email: 'outsider@example.com',
        emailVerified: true,
      });

      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const tenantA = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'pm-prov-a',
        body: {
          slug: 'pm-tenant-a',
          name: 'PM Tenant A',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-a@example.com',
          limits: {
            maxEvents: 5,
            maxStaff: 20,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      const acceptedA = await acceptMembershipInvite(db, {
        userId: ownerA.userId,
        email: 'owner-a@example.com',
        emailVerified: true,
        token: tenantA.rawInviteToken,
      });

      const tenantB = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'pm-prov-b',
        body: {
          slug: 'pm-tenant-b',
          name: 'PM Tenant B',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-b@example.com',
          limits: {
            maxEvents: 5,
            maxStaff: 20,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      await acceptMembershipInvite(db, {
        userId: ownerB.userId,
        email: 'owner-b@example.com',
        emailVerified: true,
        token: tenantB.rawInviteToken,
      });

      const mgrInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'manager-pm@example.com',
        role: 'Manager',
        clientKey: 'pm-inv-mgr',
      });
      const mgrAccepted = await acceptMembershipInvite(db, {
        userId: manager.userId,
        email: 'manager-pm@example.com',
        emailVerified: true,
        token: mgrInvite.rawToken,
      });

      let eventId;
      await withTenant(db, tenantA.tenantId, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerA.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'pm-fest',
            name: 'PM Fest',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        });
        eventId = ev.event.eventId;
      });

      // Permission: outsider cannot list
      await assert.rejects(
        () =>
          listPortalMembers(db, {
            tenantId: tenantA.tenantId,
            actorUserId: outsider.userId,
          }),
        (e) => e instanceof AuthzError || e.code === 'MEMBERSHIP_REQUIRED',
      );

      // Cross-tenant: owner B cannot manage tenant A
      await assert.rejects(
        () =>
          listPortalMembers(db, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerB.userId,
          }),
        (e) => e instanceof AuthzError || e.code === 'MEMBERSHIP_REQUIRED',
      );

      // List members: masked email, no raw PII
      const membersPage = await listPortalMembers(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        limit: 1,
      });
      assert.equal(membersPage.items.length, 1);
      assert.ok(membersPage.nextCursor);
      const blob = JSON.stringify(membersPage);
      assert.ok(!blob.includes('owner-a@example.com'));
      assert.ok(!blob.includes('manager-pm@example.com'));
      assert.ok(membersPage.items[0].emailMasked.includes('***'));

      const membersPage2 = await listPortalMembers(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        limit: 10,
        cursor: membersPage.nextCursor,
      });
      assert.ok(membersPage2.items.length >= 1);
      assert.equal(membersPage2.nextCursor, null);

      // Role change uses server allowlist; last Owner demotion blocked
      await assert.rejects(
        () =>
          changePortalMemberRole(db, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            membershipId: acceptedA.membershipId,
            role: 'Manager',
            reason: 'step down alone',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
      );

      // Promote manager → second Owner, then demote original Owner OK
      await changePortalMemberRole(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        role: 'Owner',
        reason: 'promote co-owner',
      });
      await changePortalMemberRole(db, {
        tenantId: tenantA.tenantId,
        actorUserId: manager.userId,
        membershipId: acceptedA.membershipId,
        role: 'Manager',
        reason: 'demote after co-owner',
      });

      // Concurrent last-owner demotion race: only one Owner left after demote above? 
      // Re-promote ownerA, demote manager back so one Owner; then race two demotions.
      await changePortalMemberRole(db, {
        tenantId: tenantA.tenantId,
        actorUserId: manager.userId,
        membershipId: acceptedA.membershipId,
        role: 'Owner',
        reason: 'restore owner A',
      });
      await changePortalMemberRole(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        role: 'Manager',
        reason: 'manager again',
      });

      // Event assignment put/delete with role-map permissions
      await putPortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        eventId,
        role: 'CS',
        reason: 'assign CS desk',
      });
      const afterAssign = await listPortalMembers(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        limit: 50,
      });
      const mgrRow = afterAssign.items.find(
        (m) => m.membershipId === mgrAccepted.membershipId,
      );
      assert.ok(mgrRow);
      assert.equal(mgrRow.eventAssignments.length, 1);
      assert.deepEqual(
        mgrRow.eventAssignments[0].permissions.sort(),
        eventPermissionsForRole('CS').slice().sort(),
      );

      await deletePortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        eventId,
        reason: 'revoke desk',
      });
      const afterDelete = await listPortalMembers(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        limit: 50,
      });
      const mgrRow2 = afterDelete.items.find(
        (m) => m.membershipId === mgrAccepted.membershipId,
      );
      assert.equal(mgrRow2.eventAssignments.length, 0);

      // Invites list + mask + revoke + resend rate-limit
      const pendingInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'pending-staff@example.com',
        role: 'Scanner',
        clientKey: 'pm-inv-pending',
      });
      const invites = await listPortalInvites(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        state: 'PENDING',
      });
      assert.ok(invites.items.some((i) => i.inviteId === pendingInvite.inviteId));
      const invBlob = JSON.stringify(invites);
      assert.ok(!invBlob.includes('pending-staff@example.com'));
      assert.ok(!invBlob.includes(pendingInvite.rawToken));

      const resent = await resendPortalInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        inviteId: pendingInvite.inviteId,
        reason: 'first resend',
      });
      assert.equal(resent.state, 'PENDING');
      assert.ok(!('rawToken' in resent));

      await assert.rejects(
        () =>
          resendPortalInvite(db, security, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            inviteId: pendingInvite.inviteId,
            reason: 'too soon',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RATE_LIMITED,
      );

      const revoked = await revokePortalInvite(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        inviteId: pendingInvite.inviteId,
        reason: 'cancel invite',
      });
      assert.equal(revoked.state, 'REVOKED');
      const revokedAgain = await revokePortalInvite(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        inviteId: pendingInvite.inviteId,
        reason: 'idempotent',
      });
      assert.equal(revokedAgain.state, 'REVOKED');

      const revokedList = await listPortalInvites(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        state: 'REVOKED',
      });
      assert.ok(
        revokedList.items.some((i) => i.inviteId === pendingInvite.inviteId),
      );

      await assert.rejects(
        () =>
          resendPortalInvite(db, security, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            inviteId: pendingInvite.inviteId,
            reason: 'after revoke',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
      );

      // Last-owner race on concurrent demotions of sole Owner
      const raceInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'coowner-race@example.com',
        role: 'Owner',
        clientKey: 'pm-inv-race',
      });
      // Keep only ownerA as Owner for race: manager is Manager already.
      const results = await Promise.allSettled([
        changePortalMemberRole(db, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerA.userId,
          membershipId: acceptedA.membershipId,
          role: 'Manager',
          reason: 'race-1',
        }),
        changePortalMemberRole(db, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerA.userId,
          membershipId: acceptedA.membershipId,
          role: 'CS',
          reason: 'race-2',
        }),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 0);
      assert.equal(rejected.length, 2);
      assert.ok(
        rejected.every(
          (r) => r.reason.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
        ),
      );

      // Revoke membership still fail-closed for last owner
      await assert.rejects(
        () =>
          revokeMembershipKeepingLastOwner(db, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            membershipId: acceptedA.membershipId,
            reason: 'leave',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
      );

      void raceInvite;
    } finally {
      if (db) await db.$disconnect();
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
