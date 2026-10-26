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
  updateEvent,
  listMyEvents,
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
  grantEventAssignment,
  PERMISSION_CATALOG,
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
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  // Function replacement must be safe to deploy again without changing grants.
  await admin.query(
    readFileSync(
      path.join(
        MIGRATIONS_DIR,
        '202610260001_vcx969_event_update_grants',
        'migration.sql',
      ),
      'utf8',
    ),
  );
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

      // The stored event grant, not the membership role label, controls PATCH.
      assert.ok(PERMISSION_CATALOG.includes('event.update'));
      assert.ok(eventPermissionsForRole('Manager').includes('event.update'));
      assert.ok(eventPermissionsForRole('Owner').includes('event.update'));
      assert.ok(!eventPermissionsForRole('CS').includes('event.update'));
      const patchAs = (actorUserId, tenantId, expectedRevision, name) =>
        withTenant(db, tenantId, (tx) =>
          updateEvent(tx, {
            tenantId,
            eventId,
            actorUserId,
            idempotencyKey: randomUUID(),
            body: { expectedRevision, name },
          }),
        );
      await assert.rejects(
        () => patchAs(manager.userId, tenantA.tenantId, 1, 'Unassigned'),
        (e) => e instanceof AuthzError,
      );

      // F01 (#969): persisted custom grant — listMyEvents must not add event.update.
      const restrictedPerms = ['report.read', 'cs.lookup'];
      await withTenant(db, tenantA.tenantId, (tx) =>
        grantEventAssignment(tx, {
          tenantId: tenantA.tenantId,
          eventId,
          membershipId: mgrAccepted.membershipId,
          permissions: restrictedPerms,
        }),
      );
      const f01Discovery = await listMyEvents(db, manager.userId);
      assert.equal(f01Discovery.items.length, 1);
      assert.deepEqual(
        [...f01Discovery.items[0].permissions].sort(),
        [...restrictedPerms].sort(),
      );
      assert.ok(!f01Discovery.items[0].permissions.includes('event.update'));
      await assert.rejects(
        () => patchAs(manager.userId, tenantA.tenantId, 1, 'F01 Restricted'),
        (e) => e instanceof AuthzError,
      );

      // Legacy materialized Manager grant remains denied until explicit reassign.
      const legacyPerms = eventPermissionsForRole('Manager').filter(
        (p) => p !== 'event.update',
      );
      await withTenant(db, tenantA.tenantId, (tx) =>
        tx.eventAssignment.updateMany({
          where: {
            tenantId: tenantA.tenantId,
            membershipId: mgrAccepted.membershipId,
            eventId,
          },
          data: { permissions: legacyPerms },
        }),
      );
      const legacyDiscovery = await listMyEvents(db, manager.userId);
      assert.ok(!legacyDiscovery.items[0].permissions.includes('event.update'));
      await assert.rejects(
        () => patchAs(manager.userId, tenantA.tenantId, 1, 'Legacy Manager'),
        (e) => e instanceof AuthzError,
      );

      await putPortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        eventId,
        role: 'Manager',
        reason: 'manage event',
      });
      const managerDiscovery = await listMyEvents(db, manager.userId);
      assert.ok(managerDiscovery.items[0].permissions.includes('event.update'));
      const managerUpdated = await patchAs(
        manager.userId,
        tenantA.tenantId,
        1,
        'Managed Event',
      );
      assert.equal(managerUpdated.event.name, 'Managed Event');

      // A Manager membership may deliberately hold a restricted assignment.
      await putPortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        eventId,
        role: 'CS',
        reason: 'restrict event to CS',
      });
      const restrictedDiscovery = await listMyEvents(db, manager.userId);
      assert.ok(
        !restrictedDiscovery.items[0].permissions.includes('event.update'),
      );
      await assert.rejects(
        () => patchAs(manager.userId, tenantA.tenantId, 2, 'Forged Manager'),
        (e) => e instanceof AuthzError,
      );
      await withTenant(
        db,
        tenantA.tenantId,
        (tx) =>
          tx.$executeRaw`
          UPDATE event_assignments
          SET permissions = ARRAY['report.read']::text[]
          WHERE tenant_id = ${tenantA.tenantId}::uuid
            AND membership_id = ${mgrAccepted.membershipId}::uuid
            AND event_id = ${eventId}::uuid
        `,
      );
      const reportOnlyDiscovery = await listMyEvents(db, manager.userId);
      assert.deepEqual(reportOnlyDiscovery.items[0].permissions, [
        'report.read',
      ]);
      await assert.rejects(
        () => patchAs(manager.userId, tenantA.tenantId, 2, 'Report Only'),
        (e) => e instanceof AuthzError,
      );

      // SQL invite acceptance materializes the new grant for fresh assignments.
      const invitedManager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'invited-manager-pm',
        email: 'invited-manager-pm@example.com',
        emailVerified: true,
      });
      const managerWithAssignment = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'invited-manager-pm@example.com',
        role: 'Manager',
        eventAssignments: [{ eventId, role: 'Manager' }],
        clientKey: 'pm-inv-mgr-assigned',
      });
      await acceptMembershipInvite(db, {
        userId: invitedManager.userId,
        email: 'invited-manager-pm@example.com',
        emailVerified: true,
        token: managerWithAssignment.rawToken,
      });
      const invitedDiscovery = await listMyEvents(db, invitedManager.userId);
      assert.ok(invitedDiscovery.items[0].permissions.includes('event.update'));
      const invitedUpdated = await patchAs(
        invitedManager.userId,
        tenantA.tenantId,
        2,
        'Invite Managed',
      );
      assert.equal(invitedUpdated.event.name, 'Invite Managed');
      await assert.rejects(
        () =>
          patchAs(invitedManager.userId, tenantB.tenantId, 3, 'Other Tenant'),
        (e) => e instanceof AuthzError,
      );

      const csUser = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'cs-pm',
        email: 'cs-pm@example.com',
        emailVerified: true,
      });
      const csInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'cs-pm@example.com',
        role: 'CS',
        eventAssignments: [{ eventId, role: 'CS' }],
        clientKey: 'pm-inv-cs-assigned',
      });
      await acceptMembershipInvite(db, {
        userId: csUser.userId,
        email: 'cs-pm@example.com',
        emailVerified: true,
        token: csInvite.rawToken,
      });
      const csDiscovery = await listMyEvents(db, csUser.userId);
      assert.ok(!csDiscovery.items[0].permissions.includes('event.update'));
      await assert.rejects(
        () => patchAs(csUser.userId, tenantA.tenantId, 3, 'CS Update'),
        (e) => e instanceof AuthzError,
      );

      const otherOwner = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'unassigned-owner-pm',
        email: 'unassigned-owner-pm@example.com',
        emailVerified: true,
      });
      const ownerInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'unassigned-owner-pm@example.com',
        role: 'Owner',
        clientKey: 'pm-inv-owner-unassigned',
      });
      const ownerAccepted = await acceptMembershipInvite(db, {
        userId: otherOwner.userId,
        email: 'unassigned-owner-pm@example.com',
        emailVerified: true,
        token: ownerInvite.rawToken,
      });
      await assert.rejects(
        () =>
          patchAs(otherOwner.userId, tenantA.tenantId, 3, 'Owner Unassigned'),
        (e) => e instanceof AuthzError,
      );
      await putPortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: ownerAccepted.membershipId,
        eventId,
        role: 'Owner',
        reason: 'assign owner',
      });
      const ownerUpdated = await patchAs(
        otherOwner.userId,
        tenantA.tenantId,
        3,
        'Assigned Owner',
      );
      assert.equal(ownerUpdated.event.name, 'Assigned Owner');
      await putPortalEventAssignment(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: ownerAccepted.membershipId,
        eventId,
        role: 'CS',
        reason: 'restrict owner event permission',
      });
      await assert.rejects(
        () =>
          patchAs(otherOwner.userId, tenantA.tenantId, 4, 'Owner Restricted'),
        (e) => e instanceof AuthzError,
      );
      await revokeMembershipKeepingLastOwner(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: ownerAccepted.membershipId,
        reason: 'finish owner permission test',
      });

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
      assert.ok(
        invites.items.some((i) => i.inviteId === pendingInvite.inviteId),
      );
      const invBlob = JSON.stringify(invites);
      assert.ok(!invBlob.includes('pending-staff@example.com'));
      assert.ok(!invBlob.includes(pendingInvite.rawToken));
      assert.equal(
        invites.items.find((i) => i.inviteId === pendingInvite.inviteId)
          .deliveryState,
        'PENDING',
      );

      // deliveryStateFromOutbox: COMPLETE→ACCEPTED, DEAD→FAILED,
      // LEASED/PROCESSING→PENDING, missing→UNKNOWN; list stays masked.
      async function setOutboxStatus(status) {
        await withTenant(db, tenantA.tenantId, async (tx) => {
          await tx.$executeRaw`
            UPDATE outbox SET status = ${status}, updated_at = now()
            WHERE tenant_id = ${tenantA.tenantId}::uuid
              AND type = 'MembershipInvite'
              AND aggregate_id = ${pendingInvite.inviteId}::uuid
          `;
        });
      }
      async function deliveryOf(inviteId) {
        const page = await listPortalInvites(db, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerA.userId,
          state: 'PENDING',
        });
        const row = page.items.find((i) => i.inviteId === inviteId);
        assert.ok(row);
        const blob = JSON.stringify(page);
        assert.ok(!blob.includes('pending-staff@example.com'));
        assert.ok(!blob.includes(pendingInvite.rawToken));
        return row.deliveryState;
      }
      await setOutboxStatus('COMPLETE');
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'ACCEPTED');
      await setOutboxStatus('DEAD');
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'FAILED');
      await setOutboxStatus('LEASED');
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'PENDING');
      await setOutboxStatus('PROCESSING');
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'PENDING');
      await setOutboxStatus('PENDING');
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'PENDING');
      await withTenant(db, tenantA.tenantId, async (tx) => {
        await tx.$executeRaw`
          DELETE FROM outbox
          WHERE tenant_id = ${tenantA.tenantId}::uuid
            AND type = 'MembershipInvite'
            AND aggregate_id = ${pendingInvite.inviteId}::uuid
        `;
      });
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'UNKNOWN');
      // Restore a PENDING outbox so later resend/revoke paths remain valid.
      const restoredOutboxId = randomUUID();
      await withTenant(db, tenantA.tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, created_at, updated_at
          ) VALUES (
            ${tenantA.tenantId}::uuid, NULL, ${restoredOutboxId}::uuid,
            'MembershipInvite', ${pendingInvite.inviteId}::uuid, 1,
            ${JSON.stringify({})}::jsonb, 'PENDING', 0, now(), now()
          )
        `;
      });
      assert.equal(await deliveryOf(pendingInvite.inviteId), 'PENDING');

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

      // Co-owner demote vs revoke cross-race under shared lock order:
      // third Owner acts so neither RPC loses members.manage mid-flight.
      await changePortalMemberRole(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        membershipId: mgrAccepted.membershipId,
        role: 'Owner',
        reason: 'promote for cross-race',
      });
      const crossActorInvite = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'owner-b@example.com',
        role: 'Owner',
        clientKey: 'pm-inv-cross-actor',
      });
      const crossActor = await acceptMembershipInvite(db, {
        userId: ownerB.userId,
        email: 'owner-b@example.com',
        emailVerified: true,
        token: crossActorInvite.rawToken,
      });
      void crossActor;
      const cross = await Promise.allSettled([
        changePortalMemberRole(db, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerB.userId,
          membershipId: acceptedA.membershipId,
          role: 'Manager',
          reason: 'cross-demote-owner-a',
        }),
        revokeMembershipKeepingLastOwner(db, {
          tenantId: tenantA.tenantId,
          actorUserId: ownerB.userId,
          membershipId: mgrAccepted.membershipId,
          reason: 'cross-revoke-co-owner',
        }),
      ]);
      const crossFulfilled = cross.filter((r) => r.status === 'fulfilled');
      const crossRejected = cross.filter((r) => r.status === 'rejected');
      assert.equal(crossFulfilled.length + crossRejected.length, 2);
      assert.equal(
        crossRejected.length,
        0,
        'stable actor should complete demote+revoke without deadlock/errors: ' +
          JSON.stringify(
            crossRejected.map((r) => ({
              code: r.reason?.code,
              message: r.reason?.message,
            })),
          ),
      );
      assert.equal(crossFulfilled.length, 2);
      const ownerCountRows = await withTenant(
        db,
        tenantA.tenantId,
        async (tx) =>
          tx.$queryRaw`
            SELECT count(*)::int AS n FROM memberships
            WHERE tenant_id = ${tenantA.tenantId}::uuid
              AND role = 'Owner'
              AND revoked_at IS NULL
              AND activated_at IS NOT NULL
          `,
      );
      assert.ok(
        (ownerCountRows[0]?.n ?? 0) >= 1,
        'co-owner demote/revoke race must leave ≥1 active Owner',
      );
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
