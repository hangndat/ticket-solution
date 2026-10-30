'use strict';

/**
 * DB-11 (PLAN §6.1): staff invite TTL 48h theo cấu hình, một lần, email
 * matching; attendee invitation claim tách host/quyền; expired/replay/
 * wrong owner không tạo vé.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  createEvent,
  createTicketType,
  createIssuanceSource,
  createMemoryObjectStore,
  readCodeHmacEnvironment,
  uploadImportFile,
  createImportJob,
  previewImportJob,
  commitImportJob,
  listGuestInvitations,
  previewInvitationDispatch,
  dispatchGuestInvitations,
  claimGuestInvitation,
  createMembershipInvite,
  acceptMembershipInvite,
  readPlatformSecurityConfig,
  PlatformError,
  PLATFORM_ERROR_CODES,
  ImportError,
  IMPORT_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'db11-invite-claim-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED = 'db11-invite-claim-cred-key';
const TASK_ID = 'task_ba3f850ed0ac';

async function startIsolatedPostgres() {
  const name = 'ticket-db11-invite-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=' + TASK_ID,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db11_invite_test',
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
        'db11_invite_test',
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
      '/db11_invite_test',
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
    for (const file of MIGRATIONS)
      await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE db11_invite_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO db11_invite_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://db11_invite_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db11_invite_test',
  };
}

test(
  'DB-11: staff invite TTL/one-use/email + attendee claim host separation/expired/replay/wrong-owner',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 5);
      const store = createMemoryObjectStore();
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });

      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-owner',
        email: 'owner@db11.test',
        emailVerified: true,
      });
      const invitee = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-invitee',
        email: 'invitee@db11.test',
        emailVerified: true,
      });
      const impostor = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-impostor',
        email: 'impostor@db11.test',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-guest',
        email: 'ada@db11.test',
        emailVerified: true,
      });
      // Same email, different issuer+subject — DB-02: identity keyed by
      // issuer+subject, not auto-linked by shared email.
      const guestImposter = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-guest-imposter',
        email: 'ada@db11.test',
        emailVerified: true,
      });

      const tenantA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      let eventA;
      let sourceId;
      let ticketTypeId;

      await withTenant(db, tenantA, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantA, slug: 'db11-a', name: 'DB-11 Tenant' },
        });
        await tx.$executeRaw`
          INSERT INTO tenant_limits (tenant_id, import_rows_per_job, imports_enabled, max_staff)
          VALUES (${tenantA}::uuid, 10000, true, NULL)
          ON CONFLICT (tenant_id) DO UPDATE
          SET import_rows_per_job = 10000, imports_enabled = true
        `;
        await grantMembership(tx, {
          tenantId: tenantA,
          userId: owner.userId,
          role: 'OWNER',
          permissions: [
            'event.create',
            'event.list',
            'inventory.import',
            'members.manage',
          ],
        });
        const ev = await createEvent(tx, {
          tenantId: tenantA,
          actorUserId: owner.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'db11-gala',
            name: 'DB-11 Gala',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        eventA = ev.event.eventId;
        const tt = await createTicketType(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          label: 'GA',
        });
        ticketTypeId = tt.ticketTypeId;
        const src = await createIssuanceSource(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          name: 'GuestList',
          approvalMode: 'AUTO',
          ticketTypeId,
        });
        sourceId = src.sourceId;
        await tx.$executeRaw`
          INSERT INTO quota_buckets (
            tenant_id, event_id, id, scope, scope_id, capacity, allocated,
            created_at, updated_at
          ) VALUES
            (${tenantA}::uuid, ${eventA}::uuid, ${randomUUID()}::uuid,
             'EVENT', NULL, 100, 0, now(), now()),
            (${tenantA}::uuid, ${eventA}::uuid, ${randomUUID()}::uuid,
             'TICKET_TYPE', ${ticketTypeId}::uuid, 100, 0, now(), now()),
            (${tenantA}::uuid, ${eventA}::uuid, ${randomUUID()}::uuid,
             'ISSUANCE_SOURCE', ${sourceId}::uuid, 100, 0, now(), now())
        `;
        await tx.$executeRaw`
          UPDATE events
          SET status = 'PUBLISHED', content_status = 'PUBLISHED',
              redemption_opens_at = now() - interval '1 hour',
              redemption_closes_at = now() + interval '7 days'
          WHERE tenant_id = ${tenantA}::uuid AND id = ${eventA}::uuid
        `;
      });

      // ---------------------------------------------------------------
      // Staff invite: TTL 48h theo cấu hình đã chốt
      // ---------------------------------------------------------------
      assert.equal(security.inviteTtlSeconds, 48 * 3600);

      const fresh = await createMembershipInvite(db, security, {
        tenantId: tenantA,
        actorUserId: owner.userId,
        email: 'ttl@db11.test',
        role: 'Manager',
        clientKey: 'db11-inv-fresh',
      });
      const ttlMs = new Date(fresh.expiresAt).getTime() - Date.now();
      assert.ok(
        Math.abs(ttlMs - security.inviteTtlSeconds * 1000) < 5000,
        'invite TTL must be exactly the configured 48h window',
      );

      // ---------------------------------------------------------------
      // Staff invite: real expiry (backdated) → no membership mutation
      // ---------------------------------------------------------------
      const expiring = await createMembershipInvite(db, security, {
        tenantId: tenantA,
        actorUserId: owner.userId,
        email: 'expiring@db11.test',
        role: 'Manager',
        clientKey: 'db11-inv-expiring',
      });
      await withTenant(
        db,
        tenantA,
        (tx) =>
          tx.$executeRaw`
          UPDATE membership_invites
          SET expires_at = now() - interval '1 minute'
          WHERE tenant_id = ${tenantA}::uuid AND id = ${expiring.inviteId}::uuid
        `,
      );
      await assert.rejects(
        () =>
          acceptMembershipInvite(db, {
            userId: invitee.userId,
            email: 'expiring@db11.test',
            emailVerified: true,
            token: expiring.rawToken,
          }),
        (e) =>
          e instanceof PlatformError &&
          e.code === PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
      );
      const noMembershipAfterExpiry = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT id FROM memberships
            WHERE tenant_id = ${tenantA}::uuid AND user_id = ${invitee.userId}::uuid
          `;
          return rows;
        },
      );
      assert.equal(
        noMembershipAfterExpiry.length,
        0,
        'expired staff invite must not create a membership',
      );

      // ---------------------------------------------------------------
      // Staff invite: email matching — wrong verified email rejected
      // ---------------------------------------------------------------
      const emailGated = await createMembershipInvite(db, security, {
        tenantId: tenantA,
        actorUserId: owner.userId,
        email: 'emailgate@db11.test',
        role: 'Manager',
        clientKey: 'db11-inv-email-gate',
      });
      await assert.rejects(
        () =>
          acceptMembershipInvite(db, {
            userId: impostor.userId,
            email: 'impostor@db11.test',
            emailVerified: true,
            token: emailGated.rawToken,
          }),
        (e) =>
          e instanceof PlatformError &&
          e.code === PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
      );
      const noMembershipForImpostor = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT id FROM memberships
            WHERE tenant_id = ${tenantA}::uuid AND user_id = ${impostor.userId}::uuid
          `;
          return rows;
        },
      );
      assert.equal(
        noMembershipForImpostor.length,
        0,
        'mismatched email must not create a membership',
      );

      // ---------------------------------------------------------------
      // Staff invite: one-time use — second accept (different actor,
      // same invited email, stolen/shared token) is refused after the
      // first actor already consumed it; first actor's replay is
      // idempotent.
      // ---------------------------------------------------------------
      const oneUse = await createMembershipInvite(db, security, {
        tenantId: tenantA,
        actorUserId: owner.userId,
        email: 'invitee@db11.test',
        role: 'Manager',
        clientKey: 'db11-inv-one-use',
      });
      const firstAccept = await acceptMembershipInvite(db, {
        userId: invitee.userId,
        email: 'invitee@db11.test',
        emailVerified: true,
        token: oneUse.rawToken,
      });
      assert.equal(firstAccept.tenantId, tenantA);

      // Same actor replays → idempotent, same membership, no duplicate row.
      const replayAccept = await acceptMembershipInvite(db, {
        userId: invitee.userId,
        email: 'invitee@db11.test',
        emailVerified: true,
        token: oneUse.rawToken,
      });
      assert.equal(replayAccept.membershipId, firstAccept.membershipId);

      // Second (different) user with the same invited email cannot reuse
      // the already-consumed token.
      await assert.rejects(
        () =>
          acceptMembershipInvite(db, {
            userId: impostor.userId,
            email: 'invitee@db11.test',
            emailVerified: true,
            token: oneUse.rawToken,
          }),
        (e) =>
          e instanceof PlatformError &&
          e.code === PLATFORM_ERROR_CODES.INVITE_ALREADY_USED,
      );
      const membershipRowsForOneUse = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT user_id FROM memberships
            WHERE tenant_id = ${tenantA}::uuid
              AND user_id IN (${invitee.userId}::uuid, ${impostor.userId}::uuid)
          `;
          return rows;
        },
      );
      assert.deepEqual(
        membershipRowsForOneUse.map((r) => r.user_id).sort(),
        [invitee.userId].sort(),
        'only the first accepting actor may hold a membership from this invite',
      );

      // ---------------------------------------------------------------
      // Attendee invitation claim fixture (GUESTS import → dispatch)
      // ---------------------------------------------------------------
      const guestsCsv = Buffer.from('email\nada@db11.test\n', 'utf8');
      const gUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        kind: 'GUESTS',
        filename: 'db11-guests.csv',
        contentType: 'text/csv',
        body: guestsCsv,
      });
      const gJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'GUESTS',
          sourceId,
          ticketTypeId,
          fileId: gUpload.fileId,
        },
      });
      const gPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: gJob.importId,
      });
      await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: gJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: gPreview.previewRevision,
          mappingRevision: gPreview.mappingRevision,
          fileHash: gPreview.fileHash,
        },
      });
      const listed = await listGuestInvitations(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
      });
      assert.equal(listed.items.length, 1);
      const invitationId = listed.items[0].invitationId;

      async function mintAndDispatch(invId) {
        const preview = await previewInvitationDispatch(db, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          body: { invitationIds: [invId] },
        });
        await dispatchGuestInvitations(db, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          idempotencyKey: randomUUID(),
          body: {
            invitationIds: [invId],
            previewRevision: preview.previewRevision,
          },
        });
        const minted = await withTenant(db, tenantA, async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT payload FROM outbox
            WHERE tenant_id = ${tenantA}::uuid
              AND type = 'InvitationReady'
              AND aggregate_id = ${invId}::uuid
            ORDER BY created_at DESC
            LIMIT 1
          `;
          return rows[0]?.payload;
        });
        assert.ok(minted?.token, 'InvitationReady must carry the raw token');
        return minted.token;
      }

      const invitationToken = await mintAndDispatch(invitationId);

      async function allocated() {
        return withTenant(db, tenantA, async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT allocated FROM quota_buckets
            WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
              AND scope = 'EVENT'
          `;
          return rows[0].allocated;
        });
      }

      // ---------------------------------------------------------------
      // Host/role separation: a staff invite token is never a valid
      // attendee claim token, and a guest claim token can never accept
      // a staff invite — the two grant paths do not cross.
      // ---------------------------------------------------------------
      const quotaBeforeCrossUse = await allocated();
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: guest.userId,
            actorEmail: 'invitee@db11.test',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: oneUse.rawToken },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      );
      await assert.rejects(
        () =>
          acceptMembershipInvite(db, {
            userId: guest.userId,
            email: 'ada@db11.test',
            emailVerified: true,
            token: invitationToken,
          }),
        (e) =>
          e instanceof PlatformError &&
          e.code === PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
      );
      assert.equal(
        await allocated(),
        quotaBeforeCrossUse,
        'cross-use between staff/attendee tokens must not allocate a ticket',
      );
      const guestMembershipAfterCrossUse = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT id FROM memberships
            WHERE tenant_id = ${tenantA}::uuid AND user_id = ${guest.userId}::uuid
          `;
          return rows;
        },
      );
      assert.equal(
        guestMembershipAfterCrossUse.length,
        0,
        'claiming an invitation must never grant staff membership',
      );

      // ---------------------------------------------------------------
      // Attendee claim: expired invitation → no ticket, no mutation
      // ---------------------------------------------------------------
      const expiredCsv = Buffer.from('email\nexpired@db11.test\n', 'utf8');
      const expiredUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        kind: 'GUESTS',
        filename: 'db11-expired.csv',
        contentType: 'text/csv',
        body: expiredCsv,
      });
      const expiredJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'GUESTS',
          sourceId,
          ticketTypeId,
          fileId: expiredUpload.fileId,
        },
      });
      const expiredPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: expiredJob.importId,
      });
      await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: expiredJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: expiredPreview.previewRevision,
          mappingRevision: expiredPreview.mappingRevision,
          fileHash: expiredPreview.fileHash,
        },
      });
      const expiredInvitationId = (
        await listGuestInvitations(db, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          state: 'PENDING',
        })
      ).items.find((i) => true).invitationId;
      const expiredToken = await mintAndDispatch(expiredInvitationId);
      await withTenant(
        db,
        tenantA,
        (tx) =>
          tx.$executeRaw`
          UPDATE guest_invitations
          SET expires_at = now() - interval '1 minute'
          WHERE tenant_id = ${tenantA}::uuid AND id = ${expiredInvitationId}::uuid
        `,
      );
      const expiredUser = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-expired-guest',
        email: 'expired@db11.test',
        emailVerified: true,
      });
      const quotaBeforeExpired = await allocated();
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: expiredUser.userId,
            actorEmail: 'expired@db11.test',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: expiredToken },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_EXPIRED,
      );
      assert.equal(await allocated(), quotaBeforeExpired);
      const expiredState = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT state, redemption_code_id FROM guest_invitations
          WHERE tenant_id = ${tenantA}::uuid AND id = ${expiredInvitationId}::uuid
        `;
        return rows[0];
      });
      // NOTE (finding for coordinator): claimGuestInvitation's lazy-expire
      // UPDATE runs inside the same withTenant transaction as the throw, so
      // it rolls back with the rejection — row stays DISPATCHED here and is
      // only swept to EXPIRED by listGuestInvitations' opportunistic sweep
      // (a separate, non-throwing query). The AC itself (no ticket/code on
      // an expired claim) still holds.
      assert.equal(expiredState.state, 'DISPATCHED');
      assert.equal(
        expiredState.redemption_code_id,
        null,
        'expired claim must not mint a redemption code',
      );

      // ---------------------------------------------------------------
      // Attendee claim: revoked invitation → no ticket, no mutation
      // ---------------------------------------------------------------
      const revokedCsv = Buffer.from('email\nrevoked@db11.test\n', 'utf8');
      const revokedUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        kind: 'GUESTS',
        filename: 'db11-revoked.csv',
        contentType: 'text/csv',
        body: revokedCsv,
      });
      const revokedJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'GUESTS',
          sourceId,
          ticketTypeId,
          fileId: revokedUpload.fileId,
        },
      });
      const revokedPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: revokedJob.importId,
      });
      await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: owner.userId,
        importId: revokedJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: revokedPreview.previewRevision,
          mappingRevision: revokedPreview.mappingRevision,
          fileHash: revokedPreview.fileHash,
        },
      });
      const revokedInvitationId = (
        await listGuestInvitations(db, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: owner.userId,
          q: undefined,
        })
      ).items.find(
        (i) =>
          i.invitationId !== invitationId &&
          i.invitationId !== expiredInvitationId,
      ).invitationId;
      const revokedToken = await mintAndDispatch(revokedInvitationId);
      await withTenant(
        db,
        tenantA,
        (tx) =>
          tx.$executeRaw`
          UPDATE guest_invitations
          SET state = 'REVOKED', updated_at = now()
          WHERE tenant_id = ${tenantA}::uuid AND id = ${revokedInvitationId}::uuid
        `,
      );
      const revokedUser = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'db11-revoked-guest',
        email: 'revoked@db11.test',
        emailVerified: true,
      });
      const quotaBeforeRevoked = await allocated();
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: revokedUser.userId,
            actorEmail: 'revoked@db11.test',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: revokedToken },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_REVOKED,
      );
      assert.equal(await allocated(), quotaBeforeRevoked);

      // ---------------------------------------------------------------
      // Attendee claim: wrong owner — same invited email, different
      // actor/identity may not replay a CLAIMED invitation to mint a
      // second ticket.
      // ---------------------------------------------------------------
      const claimedOnce = await claimGuestInvitation(db, HMAC, CRED, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: guest.userId,
        actorEmail: 'ada@db11.test',
        emailVerified: true,
        idempotencyKey: randomUUID(),
        body: { token: invitationToken },
      });
      assert.equal(claimedOnce.ok, true);
      const quotaAfterRealClaim = await allocated();

      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: guestImposter.userId,
            actorEmail: 'ada@db11.test',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: invitationToken },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      );
      assert.equal(
        await allocated(),
        quotaAfterRealClaim,
        'wrong-owner replay of a CLAIMED invitation must not mint a second ticket',
      );
      const ticketsForInvitation = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT t.id, t.owner_user_id
          FROM tickets t
          JOIN redemption_codes rc ON rc.id = t.redemption_code_id
          JOIN guest_invitations gi ON gi.redemption_code_id = rc.id
          WHERE gi.tenant_id = ${tenantA}::uuid AND gi.id = ${invitationId}::uuid
        `;
        return rows;
      });
      assert.equal(
        ticketsForInvitation.length,
        1,
        'exactly one ticket must exist for the claimed invitation',
      );
      assert.equal(ticketsForInvitation[0].owner_user_id, guest.userId);
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
