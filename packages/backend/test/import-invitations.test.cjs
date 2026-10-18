'use strict';

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
  downloadImportErrors,
  getImportJob,
  listGuestInvitations,
  previewInvitationDispatch,
  dispatchGuestInvitations,
  claimGuestInvitation,
  ImportError,
  IMPORT_ERROR_CODES,
  AuthzError,
  importRedemptionCodes,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'e406-import-inv-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED = 'e406-import-inv-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-import-inv-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_35ef7a00e41e',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=import_inv_test',
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
        'import_inv_test',
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
      '/import_inv_test',
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
      "CREATE ROLE import_inv_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO import_inv_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://import_inv_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/import_inv_test',
  };
}

test(
  'H-I1/H-I2/H-I3 import jobs + guest invitations + attendee claim',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const store = createMemoryObjectStore();
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';

      const manager = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'imp-mgr',
        email: 'mgr@import.test',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'imp-guest',
        email: 'ada@example.com',
        emailVerified: true,
      });
      const outsider = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'imp-out',
        email: 'out@example.com',
        emailVerified: true,
      });

      const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      let eventA;
      let sourceId;
      let ticketTypeId;

      await withTenant(db, tenantA, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantA, slug: 'imp-a', name: 'Import A' },
        });
        await tx.$executeRaw`
          INSERT INTO tenant_limits (tenant_id, import_rows_per_job, imports_enabled)
          VALUES (${tenantA}::uuid, 10000, true)
          ON CONFLICT (tenant_id) DO UPDATE
          SET import_rows_per_job = 10000, imports_enabled = true
        `;
        const mem = await grantMembership(tx, {
          tenantId: tenantA,
          userId: manager.userId,
          role: 'OWNER',
          permissions: ['event.create', 'event.list', 'inventory.import'],
        });
        const ev = await createEvent(tx, {
          tenantId: tenantA,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'gala',
            name: 'Gala',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        eventA = ev.event.eventId;
        // createEvent already grants Owner event assignment — do not duplicate.
        void mem;
        const tt = await createTicketType(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          label: 'GA',
        });
        ticketTypeId = tt.ticketTypeId;
        const src = await createIssuanceSource(tx, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
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

      // I1 — reject oversized / non-utf8
      await assert.rejects(
        () =>
          uploadImportFile(db, store, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: manager.userId,
            kind: 'CODES',
            filename: 'big.csv',
            contentType: 'text/csv',
            body: Buffer.alloc(10 * 1024 * 1024 + 1, 0x61),
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      );
      await assert.rejects(
        () =>
          uploadImportFile(db, store, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: manager.userId,
            kind: 'CODES',
            filename: 'u16.csv',
            contentType: 'text/csv',
            body: Buffer.from([0xff, 0xfe, 0x61, 0x00]),
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      );

      // I2 — CODES upload → create → preview (allocated unchanged)
      const codesCsv = Buffer.from('code\nAAA-1\nAAA-2\nAAA-2\n', 'utf8');
      const uploaded = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        kind: 'CODES',
        filename: 'codes.csv',
        contentType: 'text/csv',
        body: codesCsv,
      });
      assert.ok(uploaded.fileId);
      assert.equal(uploaded.byteLength, codesCsv.length);
      assert.ok(!JSON.stringify(uploaded).includes('quarantine'));

      const createKey = randomUUID();
      const job = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: createKey,
        body: {
          kind: 'CODES',
          sourceId,
          ticketTypeId,
          fileId: uploaded.fileId,
        },
      });
      assert.equal(job.status, 'CREATED');
      const replayCreate = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: createKey,
        body: {
          kind: 'CODES',
          sourceId,
          ticketTypeId,
          fileId: uploaded.fileId,
        },
      });
      assert.equal(replayCreate.replayed, true);
      assert.equal(replayCreate.importId, job.importId);

      const allocatedBefore = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });

      const preview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: job.importId,
      });
      assert.equal(preview.validRowCount, 2);
      assert.equal(preview.errorRowCount, 1);
      assert.equal(preview.estimatedQuota, 2);
      assert.ok(preview.fileHash);

      const allocatedAfterPreview = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });
      assert.equal(allocatedAfterPreview, allocatedBefore);

      // I3c / I9 — errors CSV stream metadata (no URL)
      const errors = await downloadImportErrors(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: job.importId,
      });
      assert.ok(errors.csv.includes('line,fieldId,code,message'));
      assert.ok(!/https?:\/\//i.test(errors.csv));
      assert.ok(!errors.csv.includes('presign'));

      // I4 — stale preview while still PREVIEW_READY
      await assert.rejects(
        () =>
          commitImportJob(db, store, HMAC, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: manager.userId,
            importId: job.importId,
            idempotencyKey: randomUUID(),
            body: {
              previewRevision: preview.previewRevision + 99,
              mappingRevision: preview.mappingRevision,
              fileHash: preview.fileHash,
            },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
      );

      // I3a — commit CODES; allocated unchanged
      const commitKey = randomUUID();
      const committed = await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: job.importId,
        idempotencyKey: commitKey,
        body: {
          previewRevision: preview.previewRevision,
          mappingRevision: preview.mappingRevision,
          fileHash: preview.fileHash,
        },
      });
      assert.equal(committed.status, 'COMPLETED');
      assert.equal(committed.committedRowCount, 2);
      assert.equal(committed.replayed, false);

      const replayCommit = await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: job.importId,
        idempotencyKey: commitKey,
        body: {
          previewRevision: preview.previewRevision,
          mappingRevision: preview.mappingRevision,
          fileHash: preview.fileHash,
        },
      });
      assert.equal(replayCommit.replayed, true);
      assert.equal(replayCommit.committedRowCount, committed.committedRowCount);

      const allocatedAfterCommit = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        const codes = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM redemption_codes
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND status = 'AVAILABLE'
        `;
        return { allocated: rows[0].allocated, codes: codes[0].n };
      });
      assert.equal(allocatedAfterCommit.allocated, allocatedBefore);
      assert.equal(allocatedAfterCommit.codes, 2);

      // I7 — legacy sync path still works
      const legacy = await withTenant(db, tenantA, (tx) =>
        importRedemptionCodes(tx, HMAC, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          rawCodes: ['LEGACY-1'],
        }),
      );
      assert.equal(legacy.imported, 1);

      // I8 — cross-tenant importId → 404
      await withTenant(db, tenantB, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantB, slug: 'imp-b', name: 'Import B' },
        });
        await grantMembership(tx, {
          tenantId: tenantB,
          userId: outsider.userId,
          role: 'OWNER',
          permissions: ['inventory.import', 'event.create'],
        });
      });
      await assert.rejects(
        () =>
          getImportJob(db, {
            tenantId: tenantB,
            eventId: eventA,
            actorUserId: outsider.userId,
            importId: job.importId,
          }),
        (e) => e instanceof AuthzError || e instanceof ImportError,
      );

      // GUESTS flow — I3b / V1–V4
      const guestsCsv = Buffer.from(
        'email\nada@example.com\nbob@example.com\n',
        'utf8',
      );
      const gUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        kind: 'GUESTS',
        filename: 'guests.csv',
        contentType: 'text/csv',
        body: guestsCsv,
      });
      const gJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
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
        actorUserId: manager.userId,
        importId: gJob.importId,
      });
      assert.equal(gPreview.invitationCount, 2);
      const gCommit = await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: gJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: gPreview.previewRevision,
          mappingRevision: gPreview.mappingRevision,
          fileHash: gPreview.fileHash,
        },
      });
      assert.equal(gCommit.invitationCount, 2);

      const listed = await listGuestInvitations(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
      });
      assert.equal(listed.items.length, 2);
      for (const item of listed.items) {
        assert.ok(item.invitedEmailMasked.includes('***'));
        assert.ok(!JSON.stringify(item).includes('ada@example.com'));
        assert.ok(!('token' in item));
        assert.ok(!('invitedEmail' in item));
      }

      const allocatedMid = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });
      assert.equal(allocatedMid, allocatedBefore);

      const invitationIds = listed.items.map((i) => i.invitationId);
      const dPreview = await previewInvitationDispatch(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        body: { invitationIds },
      });
      assert.equal(dPreview.selectedCount, 2);
      // V2 — no mail outbox of InvitationReady yet
      const outboxBefore = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM outbox
          WHERE tenant_id = ${tenantA}::uuid AND type = 'InvitationReady'
        `;
        return rows[0].n;
      });
      assert.equal(outboxBefore, 0);

      const dispatchKey = randomUUID();
      const dispatched = await dispatchGuestInvitations(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: dispatchKey,
        body: {
          invitationIds,
          previewRevision: dPreview.previewRevision,
        },
      });
      assert.equal(dispatched.dispatchedCount, 2);
      const dispatchReplay = await dispatchGuestInvitations(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: dispatchKey,
        body: {
          invitationIds,
          previewRevision: dPreview.previewRevision,
        },
      });
      assert.equal(dispatchReplay.replayed, true);

      const allocatedAfterDispatch = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });
      assert.equal(allocatedAfterDispatch, allocatedBefore);

      const mintedAda = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT payload FROM outbox
          WHERE tenant_id = ${tenantA}::uuid
            AND type = 'InvitationTokenMinted'
            AND payload->>'email' = 'ada@example.com'
          ORDER BY created_at
          LIMIT 1
        `;
        return rows[0].payload;
      });
      assert.ok(mintedAda.token);
      assert.ok(!JSON.stringify(listed).includes(mintedAda.token));

      // H-I3 — email not verified (attendee host gate)
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: guest.userId,
            actorEmail: 'ada@example.com',
            emailVerified: false,
            idempotencyKey: randomUUID(),
            body: { token: mintedAda.token },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED,
      );

      // H-I3 — wrong email
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: outsider.userId,
            actorEmail: 'out@example.com',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: mintedAda.token },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH,
      );

      // Attendee claim succeeds without staff membership / inventory.import.
      const claimKey = randomUUID();
      const claimed = await claimGuestInvitation(db, HMAC, CRED, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: guest.userId,
        actorEmail: 'ada@example.com',
        emailVerified: true,
        idempotencyKey: claimKey,
        body: { token: mintedAda.token },
      });
      assert.equal(claimed.ok, true);
      assert.ok(claimed.result.ticketId);
      assert.equal(
        JSON.stringify(claimed).includes(mintedAda.token),
        false,
        'claim response must not echo raw invitation token',
      );

      const allocatedAfterClaim = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });
      assert.equal(allocatedAfterClaim, allocatedBefore + 1);

      // Idempotent replay (same key) returns the same ticket.
      const claimReplay = await claimGuestInvitation(db, HMAC, CRED, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: guest.userId,
        actorEmail: 'ada@example.com',
        emailVerified: true,
        idempotencyKey: claimKey,
        body: { token: mintedAda.token },
      });
      assert.equal(claimReplay.ok, true);
      assert.equal(claimReplay.result.ticketId, claimed.result.ticketId);
      assert.equal(claimReplay.result.replayed, true);

      // One-time token: different Idempotency-Key after CLAIMED → 410.
      await assert.rejects(
        () =>
          claimGuestInvitation(db, HMAC, CRED, {
            tenantId: tenantA,
            eventId: eventA,
            actorUserId: guest.userId,
            actorEmail: 'ada@example.com',
            emailVerified: true,
            idempotencyKey: randomUUID(),
            body: { token: mintedAda.token },
          }),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      );

      // Quota unchanged after rejected re-claim / replay.
      const allocatedAfterReuse = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
        return rows[0].allocated;
      });
      assert.equal(allocatedAfterReuse, allocatedBefore + 1);
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
