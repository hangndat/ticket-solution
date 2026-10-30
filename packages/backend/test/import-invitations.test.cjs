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
  grantEventAssignment,
  revokeEventAssignment,
  revokeMembership,
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
  listImportJobs,
  listGuestInvitations,
  previewInvitationDispatch,
  dispatchGuestInvitations,
  claimGuestInvitation,
  ImportError,
  IMPORT_ERROR_CODES,
  AuthzError,
  importRedemptionCodes,
  relayOutboxOnce,
  createNoopEmailAdapter,
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
      db = createDatabase(boot.url, 5);
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
      let managerMembershipId;
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
        managerMembershipId = mem.membershipId;
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

      const allocatedAfterPreview = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
          return rows[0].allocated;
        },
      );
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

      // #621 — CODES commit skips DB duplicates without aborting the batch
      await withTenant(db, tenantA, (tx) =>
        importRedemptionCodes(tx, HMAC, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          rawCodes: ['DUP-621-CODE'],
        }),
      );
      const dupCodesCsv = Buffer.from(
        'code\nNEW-621-A\nNEW-621-A\nDUP-621-CODE\n',
        'utf8',
      );
      const dupCodesUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        kind: 'CODES',
        filename: 'dup-codes-621.csv',
        contentType: 'text/csv',
        body: dupCodesCsv,
      });
      const dupCodesJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'CODES',
          sourceId,
          ticketTypeId,
          fileId: dupCodesUpload.fileId,
        },
      });
      const dupCodesPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: dupCodesJob.importId,
      });
      assert.equal(dupCodesPreview.validRowCount, 2);
      assert.equal(dupCodesPreview.errorRowCount, 1);
      const dupCodesCommit = await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: dupCodesJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: dupCodesPreview.previewRevision,
          mappingRevision: dupCodesPreview.mappingRevision,
          fileHash: dupCodesPreview.fileHash,
        },
      });
      assert.equal(dupCodesCommit.committedRowCount, 1);
      assert.equal(dupCodesCommit.skippedRowCount, 1);
      assert.equal(dupCodesCommit.errorRowCount, 1);

      // DB-10 D: a real row-lock barrier proves both commits overlap at the
      // event lock. Unique code insertion must preserve an already used row.
      const usedCode = 'USED-DB10';
      await withTenant(db, tenantA, (tx) =>
        importRedemptionCodes(tx, HMAC, {
          tenantId: tenantA,
          eventId: eventA,
          actorUserId: manager.userId,
          rawCodes: [usedCode],
        }),
      );
      const usedCodeHmac = require('../dist').hashRedemptionCode(HMAC, usedCode);
      const usedBefore = await withTenant(db, tenantA, async (tx) => {
        await tx.$executeRaw`
          UPDATE redemption_codes SET status = 'CONSUMED'
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND code_hmac = ${usedCodeHmac}
        `;
        const rows = await tx.$queryRaw`
          SELECT id, status, source_id, ticket_type_id, code_pepper_version
          FROM redemption_codes
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND code_hmac = ${usedCodeHmac}
        `;
        return rows[0];
      });
      const raceBody = Buffer.from(`code\nRACE-DB10\n${usedCode}\n`);
      const raceJobs = [];
      for (let i = 0; i < 2; i++) {
        const file = await uploadImportFile(db, store, {
          tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
          kind: 'CODES', filename: `race-${i}.csv`,
          contentType: 'text/csv', body: raceBody,
        });
        const raceJob = await createImportJob(db, {
          tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: { kind: 'CODES', sourceId, ticketTypeId, fileId: file.fileId },
        });
        const racePreview = await previewImportJob(db, store, {
          tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
          importId: raceJob.importId,
        });
        raceJobs.push({ job: raceJob, preview: racePreview });
      }
      const raceStateBefore = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT
            (SELECT count(*)::int FROM redemption_codes WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS codes,
            (SELECT count(*)::int FROM tickets WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS tickets,
            (SELECT count(*)::int FROM guest_invitations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS invitations,
            (SELECT count(*)::int FROM outbox WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS outbox,
            (SELECT count(*)::int FROM audit_logs WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS audit,
            (SELECT count(*)::int FROM operations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid AND command = 'import.commit') AS commit_ops
        `;
        return rows[0];
      });
      let signalLock;
      let releaseLock;
      const locked = new Promise((resolve) => { signalLock = resolve; });
      const released = new Promise((resolve) => { releaseLock = resolve; });
      const blocker = withTenant(db, tenantA, async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM events WHERE tenant_id = ${tenantA}::uuid
            AND id = ${eventA}::uuid FOR UPDATE
        `;
        signalLock();
        await released;
      });
      await locked;
      const raceCommit = ({ job: raceJob, preview: racePreview }, key) =>
        commitImportJob(db, store, HMAC, {
          tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
          importId: raceJob.importId, idempotencyKey: key,
          body: {
            previewRevision: racePreview.previewRevision,
            mappingRevision: racePreview.mappingRevision,
            fileHash: racePreview.fileHash,
          },
        });
      const raceKeys = [randomUUID(), randomUUID()];
      const contenders = raceJobs.map((entry, i) => raceCommit(entry, raceKeys[i]));
      const observer = new Client({ connectionString: boot.url });
      try {
        await observer.connect();
        let waiting = 0;
        for (let attempt = 0; attempt < 100; attempt++) {
          const observed = await observer.query(`
            SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE wait_event_type = 'Lock'
              AND query LIKE '%SELECT id, status FROM events%'
              AND pid <> pg_backend_pid()
          `);
          waiting = observed.rows[0].n;
          if (waiting >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.ok(waiting >= 2, 'both commit transactions reached event lock');
      } finally {
        releaseLock();
        await blocker;
        await observer.end().catch(() => {});
      }
      const raceResults = await Promise.all(contenders);
      assert.deepEqual(raceResults.map((r) => r.committedRowCount).sort(), [0, 1]);
      assert.deepEqual(raceResults.map((r) => r.skippedRowCount).sort(), [1, 2]);
      for (let i = 0; i < 2; i++) {
        const replay = await raceCommit(raceJobs[i], raceKeys[i]);
        assert.equal(replay.replayed, true);
        assert.equal(replay.committedRowCount, raceResults[i].committedRowCount);
        await assert.rejects(
          () => commitImportJob(db, store, HMAC, {
            tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
            importId: raceJobs[i].job.importId, idempotencyKey: raceKeys[i],
            body: { ...raceJobs[i].preview,
              previewRevision: raceJobs[i].preview.previewRevision + 1 },
          }),
          (e) => e instanceof ImportError &&
            e.code === IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        );
      }
      const raceStateAfter = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT
            (SELECT count(*)::int FROM redemption_codes WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS codes,
            (SELECT count(*)::int FROM tickets WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS tickets,
            (SELECT count(*)::int FROM guest_invitations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS invitations,
            (SELECT count(*)::int FROM outbox WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS outbox,
            (SELECT count(*)::int FROM audit_logs WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS audit,
            (SELECT count(*)::int FROM operations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid AND command = 'import.commit') AS commit_ops
        `;
        const used = await tx.$queryRaw`
          SELECT id, status, source_id, ticket_type_id, code_pepper_version
          FROM redemption_codes WHERE tenant_id = ${tenantA}::uuid
            AND event_id = ${eventA}::uuid AND code_hmac = ${usedCodeHmac}
        `;
        assert.deepEqual(used[0], usedBefore);
        const jobs = await tx.$queryRaw`
          SELECT status FROM import_jobs WHERE tenant_id = ${tenantA}::uuid
            AND id IN (${raceJobs[0].job.importId}::uuid, ${raceJobs[1].job.importId}::uuid)
        `;
        assert.deepEqual(jobs.map((j) => j.status).sort(), ['COMPLETED', 'COMPLETED']);
        return rows[0];
      });
      assert.equal(raceStateAfter.codes, raceStateBefore.codes + 1);
      assert.equal(raceStateAfter.commit_ops, raceStateBefore.commit_ops + 2);
      for (const field of ['tickets', 'invitations', 'outbox', 'audit'])
        assert.equal(raceStateAfter[field], raceStateBefore[field], field);

      // DB-10 F01: two requests for the same job/key/body are already in
      // PostgreSQL transactions while the first commit is still in flight.
      const retryFile = await uploadImportFile(db, store, {
        tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
        kind: 'CODES', filename: 'retry-db10.csv', contentType: 'text/csv',
        body: Buffer.from(`code\nRETRY-DB10\n${usedCode}\n`),
      });
      const retryJob = await createImportJob(db, {
        tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
        idempotencyKey: randomUUID(),
        body: { kind: 'CODES', sourceId, ticketTypeId, fileId: retryFile.fileId },
      });
      const retryPreview = await previewImportJob(db, store, {
        tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
        importId: retryJob.importId,
      });
      const retryKey = randomUUID();
      const retryCommit = () => commitImportJob(db, store, HMAC, {
        tenantId: tenantA, eventId: eventA, actorUserId: manager.userId,
        importId: retryJob.importId, idempotencyKey: retryKey,
        body: {
          previewRevision: retryPreview.previewRevision,
          mappingRevision: retryPreview.mappingRevision,
          fileHash: retryPreview.fileHash,
        },
      });
      let unlockRetry;
      let retryLocked;
      const retryLockReady = new Promise((resolve) => { retryLocked = resolve; });
      const retryReleased = new Promise((resolve) => { unlockRetry = resolve; });
      const retryBlocker = withTenant(db, tenantA, async (tx) => {
        await tx.$queryRaw`SELECT id FROM events WHERE tenant_id = ${tenantA}::uuid
          AND id = ${eventA}::uuid FOR UPDATE`;
        retryLocked();
        await retryReleased;
      });
      await retryLockReady;
      const retryObserver = new Client({ connectionString: boot.url });
      const waitForRetryWaiters = async (minimum) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const observed = await retryObserver.query(`SELECT count(*)::int AS n
            FROM pg_stat_activity WHERE wait_event_type = 'Lock'
              AND query LIKE '%SELECT id, status FROM events%'
              AND pid <> pg_backend_pid()`);
          if (observed.rows[0].n >= minimum) return;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.fail(`${minimum} same-key commits must reach the event lock`);
      };
      let firstRetry;
      let secondRetry;
      try {
        await retryObserver.connect();
        firstRetry = retryCommit();
        await waitForRetryWaiters(1);
        secondRetry = retryCommit();
        await waitForRetryWaiters(2);
      } finally {
        unlockRetry();
        await retryBlocker;
        await retryObserver.end().catch(() => {});
      }
      const retryResults = await Promise.all([firstRetry, secondRetry]);
      assert.deepEqual(retryResults.map((result) => result.replayed).sort(), [false, true]);
      retryResults.forEach((result) => {
        assert.equal(result.importId, retryJob.importId);
        assert.equal(result.committedRowCount, 1);
        assert.equal(result.skippedRowCount, 1);
      });
      const retryStateAfter = await withTenant(db, tenantA, async (tx) => {
        const state = await tx.$queryRaw`SELECT
          (SELECT count(*)::int FROM redemption_codes WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS codes,
          (SELECT count(*)::int FROM operations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid AND command = 'import.commit') AS commit_ops,
          (SELECT count(*)::int FROM operations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid AND command = 'import.commit' AND client_key = ${retryKey}) AS same_key_ops,
          (SELECT count(*)::int FROM tickets WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS tickets,
          (SELECT count(*)::int FROM guest_invitations WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS invitations,
          (SELECT count(*)::int FROM outbox WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS outbox,
          (SELECT count(*)::int FROM audit_logs WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid) AS audit`;
        const used = await tx.$queryRaw`SELECT id, status, source_id, ticket_type_id, code_pepper_version
          FROM redemption_codes WHERE tenant_id = ${tenantA}::uuid
            AND event_id = ${eventA}::uuid AND code_hmac = ${usedCodeHmac}`;
        assert.deepEqual(used[0], usedBefore);
        return state[0];
      });
      assert.equal(retryStateAfter.codes, raceStateAfter.codes + 1);
      assert.equal(retryStateAfter.commit_ops, raceStateAfter.commit_ops + 1);
      assert.equal(retryStateAfter.same_key_ops, 1);
      for (const field of ['tickets', 'invitations', 'outbox', 'audit'])
        assert.equal(retryStateAfter[field], raceStateAfter[field], field);

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
      const invitationInput = (tenantId, eventId, actorUserId, query = {}) => ({
        tenantId,
        eventId,
        actorUserId,
        ...query,
      });
      const targetId = listed.items[0].invitationId;
      const exact = await listGuestInvitations(
        db,
        invitationInput(tenantA, eventA, manager.userId, {
          q: targetId,
          limit: 100,
        }),
      );
      assert.deepEqual(exact, { items: [listed.items[0]], nextCursor: null });
      assert.deepEqual(
        await listGuestInvitations(
          db,
          invitationInput(tenantA, eventA, manager.userId, { q: randomUUID() }),
        ),
        { items: [], nextCursor: null },
      );
      assert.deepEqual(
        await listGuestInvitations(
          db,
          invitationInput(tenantA, eventA, manager.userId, {
            q: targetId,
            state: 'CLAIMED',
          }),
        ),
        { items: [], nextCursor: null },
      );
      const legacyFirst = await listGuestInvitations(
        db,
        invitationInput(tenantA, eventA, manager.userId, { limit: 1 }),
      );
      assert.equal(legacyFirst.items.length, 1);
      assert.equal(legacyFirst.nextCursor, legacyFirst.items[0].invitationId);
      const legacySecond = await listGuestInvitations(
        db,
        invitationInput(tenantA, eventA, manager.userId, {
          limit: 1,
          cursor: legacyFirst.nextCursor,
        }),
      );
      assert.equal(legacySecond.items.length, 1);
      assert.notEqual(
        legacySecond.items[0].invitationId,
        legacyFirst.items[0].invitationId,
      );
      assert.equal(legacySecond.nextCursor, null);
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, manager.userId, {
              q: targetId,
              cursor: legacyFirst.nextCursor,
            }),
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVALID_CURSOR,
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, manager.userId, {
              q: 'ada@example.com',
            }),
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVALID_FILTER,
      );

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

      const allocatedAfterDispatch = await withTenant(
        db,
        tenantA,
        async (tx) => {
          const rows = await tx.$queryRaw`
          SELECT allocated FROM quota_buckets
          WHERE tenant_id = ${tenantA}::uuid AND event_id = ${eventA}::uuid
            AND scope = 'EVENT'
        `;
          return rows[0].allocated;
        },
      );
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

      // Issue #495 — worker mail: InvitationTokenMinted COMPLETE (no-op);
      // InvitationReady sends guest invitation email (not dead-letter).
      const sentGuest = [];
      const email = createNoopEmailAdapter();
      email.sendGuestInvitation = async (payload) => {
        sentGuest.push({
          invitationId: payload.invitationId,
          toEmail: payload.toEmail,
          claimUrl: payload.claimUrl,
          hasToken: Boolean(payload.token),
        });
        return {
          providerRef: `test-guest:${payload.invitationId}`,
          providerStatus: 'ACCEPTED',
        };
      };
      let relayed = { claimed: 0, completed: 0, failed: 0 };
      for (let i = 0; i < 5; i++) {
        const tick = await relayOutboxOnce(
          db,
          email,
          `import-inv-relay-${i}`,
          20,
          {
            credentialKeyMaterial: CRED,
            publicWebBaseUrl: 'https://app.vemoki.com',
            env: {
              NODE_ENV: 'test',
              PUBLIC_WEB_BASE_URL: 'https://app.vemoki.com',
            },
          },
        );
        relayed = {
          claimed: relayed.claimed + tick.claimed,
          completed: relayed.completed + tick.completed,
          failed: relayed.failed + tick.failed,
        };
        if (tick.claimed === 0) break;
      }
      assert.ok(relayed.completed >= 4, 'minted + ready rows should complete');
      assert.equal(relayed.failed, 0);
      assert.equal(sentGuest.length, 2);
      for (const sent of sentGuest) {
        assert.equal(sent.hasToken, true);
        assert.match(sent.claimUrl, /^https:\/\/app\.vemoki\.com\/claim#/);
        assert.match(sent.claimUrl, /token=/);
        assert.match(sent.claimUrl, /tenantId=/);
        assert.match(sent.claimUrl, /eventId=/);
        assert.ok(!sent.claimUrl.includes('?'));
      }
      const outboxAfterRelay = await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT type, status, payload->>'email' AS email
          FROM outbox
          WHERE tenant_id = ${tenantA}::uuid
            AND type IN ('InvitationTokenMinted', 'InvitationReady')
          ORDER BY type, email
        `;
        return rows;
      });
      assert.equal(outboxAfterRelay.length, 4);
      for (const row of outboxAfterRelay) {
        assert.equal(row.status, 'COMPLETE');
      }
      // Payload retained after COMPLETE so claim can still use minted token.
      const mintedAfterRelay = await withTenant(db, tenantA, async (tx) => {
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
      assert.equal(mintedAfterRelay.token, mintedAda.token);

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

      // #621 — GUESTS commit skips DB duplicates without aborting the batch
      const dupGuestEmail = 'dup621guest@example.com';
      const seedGuestCsv = Buffer.from(`email\n${dupGuestEmail}\n`, 'utf8');
      const seedGuestUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        kind: 'GUESTS',
        filename: 'seed-guest-621.csv',
        contentType: 'text/csv',
        body: seedGuestCsv,
      });
      const seedGuestJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'GUESTS',
          sourceId,
          ticketTypeId,
          fileId: seedGuestUpload.fileId,
        },
      });
      const seedGuestPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: seedGuestJob.importId,
      });
      await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: seedGuestJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: seedGuestPreview.previewRevision,
          mappingRevision: seedGuestPreview.mappingRevision,
          fileHash: seedGuestPreview.fileHash,
        },
      });
      const dupGuestsCsv = Buffer.from(
        `email\nnew621guest@example.com\nnew621guest@example.com\n${dupGuestEmail}\n`,
        'utf8',
      );
      const dupGuestsUpload = await uploadImportFile(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        kind: 'GUESTS',
        filename: 'dup-guests-621.csv',
        contentType: 'text/csv',
        body: dupGuestsCsv,
      });
      const dupGuestsJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'GUESTS',
          sourceId,
          ticketTypeId,
          fileId: dupGuestsUpload.fileId,
        },
      });
      const dupGuestsPreview = await previewImportJob(db, store, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: dupGuestsJob.importId,
      });
      assert.equal(dupGuestsPreview.validRowCount, 1);
      assert.equal(dupGuestsPreview.errorRowCount, 2);
      const dupGuestsCommit = await commitImportJob(db, store, HMAC, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        importId: dupGuestsJob.importId,
        idempotencyKey: randomUUID(),
        body: {
          previewRevision: dupGuestsPreview.previewRevision,
          mappingRevision: dupGuestsPreview.mappingRevision,
          fileHash: dupGuestsPreview.fileHash,
        },
      });
      assert.equal(dupGuestsCommit.committedRowCount, 1);
      assert.equal(dupGuestsCommit.skippedRowCount, 1);
      assert.equal(dupGuestsCommit.errorRowCount, 1);

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

      // G-09: runtime role, tenant/event RLS, permission and signed keyset cursor.
      const keysetIndexes = await db.$queryRaw`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'import_jobs'
          AND indexname IN ('import_jobs_event_created_id_idx', 'import_jobs_event_idx')
      `;
      assert.equal(keysetIndexes.length, 1);
      assert.equal(
        keysetIndexes[0].indexname,
        'import_jobs_event_created_id_idx',
      );
      assert.match(
        keysetIndexes[0].indexdef,
        /tenant_id, event_id, created_at DESC, id DESC/,
      );
      const listInput = (tenantId, eventId, actorUserId, query = {}) => ({
        tenantId,
        eventId,
        actorUserId,
        query,
      });
      const listA = (query = {}) =>
        listImportJobs(
          db,
          listInput(tenantA, eventA, manager.userId, query),
          HMAC.pepper,
        );
      const first = await listA({ limit: 1 });
      assert.equal(first.items.length, 1);
      assert.ok(first.nextCursor);
      assert.deepEqual(
        Object.keys(first.items[0]).sort(),
        [
          'createdAt',
          'errorRowCount',
          'estimatedQuota',
          'importId',
          'invitationCount',
          'kind',
          'mappingRevision',
          'previewRevision',
          'sourceId',
          'status',
          'ticketTypeId',
          'validRowCount',
        ].sort(),
      );
      assert.ok(!JSON.stringify(first).includes(uploaded.fileHash));
      const lateJob = await createImportJob(db, {
        tenantId: tenantA,
        eventId: eventA,
        actorUserId: manager.userId,
        idempotencyKey: randomUUID(),
        body: {
          kind: 'CODES',
          sourceId,
          ticketTypeId,
          fileId: uploaded.fileId,
        },
      });
      const seen = new Set(first.items.map((item) => item.importId));
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await listA({ limit: 1, cursor });
        assert.equal(page.items.length, 1);
        assert.ok(
          !seen.has(page.items[0].importId),
          'keyset never duplicates a row',
        );
        seen.add(page.items[0].importId);
        cursor = page.nextCursor;
      }
      assert.ok(
        !seen.has(lateJob.importId),
        'new head is only visible on refresh',
      );
      assert.equal((await listA()).items[0].importId, lateJob.importId);
      assert.ok(
        (await listA({ status: 'COMPLETED', kind: 'GUESTS' })).items.every(
          (item) => item.status === 'COMPLETED' && item.kind === 'GUESTS',
        ),
      );
      for (const query of [
        { cursor: 'garbage' },
        { cursor: (first.nextCursor[0] === 'A' ? 'B' : 'A') + first.nextCursor.slice(1) },
        { cursor: first.nextCursor, kind: 'GUESTS' },
        { cursor: first.nextCursor, status: 'COMPLETED' },
      ]) {
        await assert.rejects(
          () => listA(query),
          (e) =>
            e instanceof ImportError &&
            e.code === IMPORT_ERROR_CODES.INVALID_CURSOR,
        );
      }

      let eventOther;
      await withTenant(db, tenantA, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: tenantA,
          actorUserId: manager.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'other',
            name: 'Other',
            timezone: 'UTC',
            visibility: 'UNLISTED',
          },
        });
        eventOther = ev.event.eventId;
      });
      const empty = await listImportJobs(
        db,
        listInput(tenantA, eventOther, manager.userId),
        HMAC.pepper,
      );
      assert.deepEqual(empty, { items: [], nextCursor: null });
      assert.deepEqual(
        await listGuestInvitations(
          db,
          invitationInput(tenantA, eventOther, manager.userId, { q: targetId }),
        ),
        { items: [], nextCursor: null },
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantA, eventOther, manager.userId, {
              cursor: first.nextCursor,
            }),
            HMAC.pepper,
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVALID_CURSOR,
      );

      let eventTenantB;
      await withTenant(db, tenantB, async (tx) => {
        const ev = await createEvent(tx, {
          tenantId: tenantB,
          actorUserId: outsider.userId,
          idempotencyKey: randomUUID(),
          body: {
            slug: 'other-b',
            name: 'Other B',
            timezone: 'UTC',
            visibility: 'UNLISTED',
          },
        });
        eventTenantB = ev.event.eventId;
      });
      assert.deepEqual(
        await listImportJobs(
          db,
          listInput(tenantB, eventTenantB, outsider.userId),
          HMAC.pepper,
        ),
        { items: [], nextCursor: null },
      );
      assert.deepEqual(
        await listGuestInvitations(
          db,
          invitationInput(tenantB, eventTenantB, outsider.userId, {
            q: targetId,
          }),
        ),
        { items: [], nextCursor: null },
      );
      const leakedRows = await withTenant(
        db,
        tenantB,
        (tx) => tx.$queryRaw`
        SELECT id FROM import_jobs WHERE tenant_id = ${tenantA}::uuid
      `,
      );
      assert.deepEqual(
        leakedRows,
        [],
        'runtime RLS excludes tenant A rows in tenant B context',
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantB, eventTenantB, outsider.userId, {
              cursor: first.nextCursor,
            }),
            HMAC.pepper,
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.INVALID_CURSOR,
      );

      const reader = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'imp-reader',
        email: 'reader@import.test',
        emailVerified: true,
      });
      const revocable = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'imp-revocable',
        email: 'revocable@import.test',
        emailVerified: true,
      });
      let assignmentId;
      let revocableMembershipId;
      await withTenant(db, tenantA, async (tx) => {
        const readMembership = await grantMembership(tx, {
          tenantId: tenantA,
          userId: reader.userId,
          role: 'CS',
          permissions: [],
        });
        await grantEventAssignment(tx, {
          tenantId: tenantA,
          eventId: eventA,
          membershipId: readMembership.membershipId,
          permissions: ['report.read'],
        });
        const revocableMembership = await grantMembership(tx, {
          tenantId: tenantA,
          userId: revocable.userId,
          role: 'MANAGER',
          permissions: [],
        });
        revocableMembershipId = revocableMembership.membershipId;
        const assignment = await grantEventAssignment(tx, {
          tenantId: tenantA,
          eventId: eventA,
          membershipId: revocableMembership.membershipId,
          permissions: ['inventory.import'],
        });
        assignmentId = assignment.assignmentId;
      });
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventOther, revocable.userId, {
              q: targetId,
            }),
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EVENT_NOT_FOUND &&
          e.httpStatus === 404,
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantA, eventA, reader.userId),
            HMAC.pepper,
          ),
        (e) => e instanceof AuthzError,
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, reader.userId, { q: targetId }),
          ),
        (e) => e instanceof AuthzError && e.code === 'PERMISSION_DENIED',
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, randomUUID(), manager.userId, {
              q: targetId,
            }),
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EVENT_NOT_FOUND &&
          e.httpStatus === 404,
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, outsider.userId, {
              q: targetId,
            }),
          ),
        (e) => e instanceof AuthzError,
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantA, randomUUID(), manager.userId),
            HMAC.pepper,
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EVENT_NOT_FOUND,
      );
      assert.equal(
        (
          await listImportJobs(
            db,
            listInput(tenantA, eventA, revocable.userId),
            HMAC.pepper,
          )
        ).items.length > 0,
        true,
      );
      assert.equal(
        (
          await listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, revocable.userId, {
              q: targetId,
            }),
          )
        ).items[0]?.invitationId,
        targetId,
      );
      await withTenant(db, tenantA, (tx) =>
        revokeEventAssignment(tx, tenantA, assignmentId),
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, revocable.userId, {
              q: targetId,
            }),
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EVENT_NOT_FOUND &&
          e.httpStatus === 404,
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantA, eventA, revocable.userId, {
              cursor: first.nextCursor,
            }),
            HMAC.pepper,
          ),
        (e) =>
          e instanceof ImportError &&
          e.code === IMPORT_ERROR_CODES.EVENT_NOT_FOUND,
      );
      await withTenant(db, tenantA, (tx) =>
        revokeMembership(tx, tenantA, revocableMembershipId),
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, revocable.userId, {
              q: targetId,
            }),
          ),
        (e) => e instanceof AuthzError && e.code === 'MEMBERSHIP_REVOKED',
      );
      await assert.rejects(
        () =>
          listImportJobs(
            db,
            listInput(tenantA, eventA, revocable.userId),
            HMAC.pepper,
          ),
        (e) => e instanceof AuthzError && e.code === 'MEMBERSHIP_REVOKED',
      );
      assert.equal(
        (
          await listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, manager.userId, { q: targetId }),
          )
        ).items[0]?.invitationId,
        targetId,
      );
      await withTenant(db, tenantA, (tx) =>
        revokeMembership(tx, tenantA, managerMembershipId),
      );
      await assert.rejects(
        () =>
          listGuestInvitations(
            db,
            invitationInput(tenantA, eventA, manager.userId, {
              q: targetId,
            }),
          ),
        (e) => e instanceof AuthzError && e.code === 'MEMBERSHIP_REVOKED',
      );
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
