const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  listCsTickets,
  getCsTicket,
  resendTicketEmail,
  createExportJob,
  getExportJob,
  downloadExport,
  processExportJob,
  relayExportsOnce,
  createEvent,
  listEvents,
  createTicketType,
  createIssuanceSource,
  registerDeviceToken,
  revokeDeviceToken,
  revokeMembership,
  listActiveDeviceTokensForUser,
  relayOutboxOnce,
  createNoopEmailAdapter,
  ExportError,
  AuthzError,
  providerStatusFromDbState,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const { migrationFiles } = require('./migration-files.cjs');
const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd4-cs-export-test-pepper!',
  CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'd4-cs-export-credential';

async function startFakeMinio() {
  const store = new Map();
  const bucket = 'ticket-exports';
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const key = decodeURIComponent(url.pathname.replace(`/${bucket}/`, ''));
    const auth = req.headers.authorization || '';
    if (!String(auth).startsWith('AWS4-HMAC-SHA256 ')) {
      res.statusCode = 403;
      res.end('unsigned');
      return;
    }
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        store.set(key, Buffer.concat(chunks));
        res.statusCode = 200;
        res.end();
      });
      return;
    }
    if (req.method === 'GET') {
      const body = store.get(key);
      if (!body) {
        res.statusCode = 404;
        res.end('missing');
        return;
      }
      res.statusCode = 200;
      res.end(body);
      return;
    }
    res.statusCode = 405;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    close: () => new Promise((r) => server.close(r)),
    cfg: {
      endpoint: `http://127.0.0.1:${port}`,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      bucket,
      region: 'us-east-1',
    },
  };
}

async function startIsolatedPostgres() {
  const name = 'ticket-d4-cs-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d4_cs_test',
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
        'd4_cs_test',
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
      '/d4_cs_test',
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
      "CREATE ROLE d4_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d4_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://d4_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d4_cs_test',
  };
}

test(
  'CS lookup/export/events/device tokens: authz, mask, MinIO, delivery honesty',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    let minio;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      minio = await startFakeMinio();
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const cs = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'cs-agent',
        email: 'cs@example.com',
        emailVerified: true,
      });
      const manager = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'mgr',
        email: 'mgr@example.com',
        emailVerified: true,
      });
      const stranger = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'stranger',
        email: 'stranger@example.com',
        emailVerified: true,
      });
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'attendee',
        email: 'attendee@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      let eventId;
      let csMembershipId;

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'cs-a', name: 'CS A' },
        });
        await grantMembership(tx, {
          tenantId,
          userId: manager.userId,
          role: 'OWNER',
          permissions: ['event.create', 'event.list'],
        });
        const createKey = randomUUID();
        const ev = await createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body: {
            slug: 'fest',
            name: 'Fest',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        eventId = ev.event.eventId;
        const replay = await createEvent(tx, {
          tenantId,
          actorUserId: manager.userId,
          idempotencyKey: createKey,
          body: {
            slug: 'fest',
            name: 'Fest',
            timezone: 'Asia/Ho_Chi_Minh',
            visibility: 'UNLISTED',
          },
        });
        assert.equal(replay.replayed, true);
        assert.equal(replay.event.eventId, eventId);

        const tt = await createTicketType(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          label: 'GA',
        });
        await createIssuanceSource(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          name: 'Door',
          approvalMode: 'AUTO',
          ticketTypeId: tt.ticketTypeId,
        });
        const listed = await listEvents(tx, {
          tenantId,
          actorUserId: manager.userId,
        });
        assert.ok(listed.items.some((i) => i.eventId === eventId));

        const mem = await grantMembership(tx, {
          tenantId,
          userId: cs.userId,
          role: 'CS',
          permissions: [
            'cs.lookup',
            'cs.resend',
            'export.create',
            'export.download',
          ],
        });
        csMembershipId = mem.membershipId;
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: mem.membershipId,
          permissions: [
            'cs.lookup',
            'cs.resend',
            'export.create',
            'export.download',
          ],
        });
        await grantMembership(tx, {
          tenantId,
          userId: stranger.userId,
          role: 'GUEST',
          permissions: [],
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: ['CODE-CS-1', 'CODE-CS-2'],
        });
      });

      const issued = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: attendee.userId,
          actorEmail: 'attendee@example.com',
          emailVerified: true,
          rawCode: 'CODE-CS-1',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        }),
      );
      const ticket = unwrapRedeemOutcome(issued);

      let exportId;
      await withTenant(db, tenantId, async (tx) => {
        await assert.rejects(
          () =>
            listCsTickets(tx, HMAC, {
              tenantId,
              eventId,
              actorUserId: stranger.userId,
            }),
          (e) => e instanceof AuthzError,
        );

        const list = await listCsTickets(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          q: 'attendee@example.com',
        });
        assert.equal(list.items.length, 1);
        assert.equal(list.items[0].ownerEmailMasked, 'a***@example.com');
        assert.ok(!JSON.stringify(list.items).includes('attendee@example.com'));

        const detail = await getCsTicket(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          ticketId: ticket.ticketId,
        });
        assert.ok(detail.timeline.length >= 1);
        if (detail.notification) {
          assert.equal(
            detail.notification.providerStatus,
            providerStatusFromDbState(detail.notification.state),
          );
          assert.equal(detail.notification.lastError, null);
        }

        const resend = await resendTicketEmail(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          ticketId: ticket.ticketId,
          clientKey: 'resend-1',
        });
        assert.equal(resend.providerStatus, 'PENDING');
        const resendReplay = await resendTicketEmail(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          ticketId: ticket.ticketId,
          clientKey: 'resend-1',
        });
        assert.equal(resendReplay.replayed, true);

        const job = await createExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          clientKey: 'exp-1',
          filter: { states: ['ACTIVE'] },
          ttlSeconds: 3600,
        });
        assert.equal(job.status, 'PENDING');
        exportId = job.exportId;
      });

      await processExportJob(db, minio.cfg, tenantId, exportId, 3600);

      await withTenant(db, tenantId, async (tx) => {
        const status = await getExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          exportId,
        });
        assert.equal(status.status, 'READY');
        assert.ok((status.rowCount ?? 0) >= 1);
      });
      {
        const file = await downloadExport(db, minio.cfg, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          exportId,
        });
        const csv = file.body.toString('utf8');
        assert.ok(csv.includes('ticketId'));
        assert.ok(csv.includes('a***@example.com'));
        assert.ok(!csv.includes('attendee@example.com'));
      }

      // Production-like roles: ticket_runtime (NOBYPASSRLS) create → claim → process → download.
      // claim_exports_batch is SECURITY DEFINER owned by migration_owner (not superuser).
      {
        const fnOwner = await db.$queryRaw`
          SELECT r.rolname AS owner, r.rolbypassrls, r.rolsuper
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          JOIN pg_roles r ON r.oid = p.proowner
          WHERE n.nspname = 'public'
            AND p.proname = 'claim_exports_batch'
        `;
        assert.equal(fnOwner[0].owner, 'migration_owner');
        assert.equal(fnOwner[0].rolbypassrls, false);
        assert.equal(fnOwner[0].rolsuper, false);

        let claimedId;
        await withTenant(db, tenantId, async (tx) => {
          const job = await createExportJob(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            clientKey: 'exp-claim-path',
            filter: { states: ['ACTIVE'] },
            ttlSeconds: 3600,
          });
          assert.equal(job.status, 'PENDING');
          claimedId = job.exportId;
        });
        const minioEnv = {
          MINIO_ENDPOINT: minio.cfg.endpoint,
          MINIO_ACCESS_KEY: minio.cfg.accessKey,
          MINIO_SECRET_KEY: minio.cfg.secretKey,
          MINIO_EXPORTS_ACCESS_KEY: minio.cfg.accessKey,
          MINIO_EXPORTS_SECRET_KEY: minio.cfg.secretKey,
          MINIO_BUCKET_EXPORTS: minio.cfg.bucket,
          MINIO_BUCKET: minio.cfg.bucket,
          MINIO_REGION: minio.cfg.region,
          EXPORT_TTL_SECONDS: '3600',
        };
        const relayed = await relayExportsOnce(
          db,
          minioEnv,
          'worker-claim-a',
          5,
        );
        assert.ok(
          relayed.claimed >= 1,
          'claim must see PENDING under FORCE RLS',
        );
        assert.ok(relayed.completed >= 1);
        const claimedFile = await downloadExport(db, minio.cfg, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          exportId: claimedId,
        });
        assert.ok(claimedFile.body.toString('utf8').includes('ticketId'));

        // Stale PROCESSING lease reclaim by a different worker after expiry.
        let reclaimId;
        await withTenant(db, tenantId, async (tx) => {
          const job = await createExportJob(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            clientKey: 'exp-reclaim',
            filter: { states: ['ACTIVE'] },
            ttlSeconds: 3600,
          });
          reclaimId = job.exportId;
          await tx.$executeRaw`
            UPDATE exports
            SET status = 'PROCESSING',
                lease_owner = 'dead-worker',
                lease_expires_at = now() - interval '1 minute',
                updated_at = now()
            WHERE tenant_id = ${tenantId}::uuid AND id = ${reclaimId}::uuid
          `;
        });
        const reclaimed = await relayExportsOnce(
          db,
          minioEnv,
          'worker-reclaim-b',
          5,
        );
        assert.ok(reclaimed.claimed >= 1, 'expired lease must be reclaimable');
        assert.ok(reclaimed.completed >= 1);
        await withTenant(db, tenantId, async (tx) => {
          const status = await getExportJob(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            exportId: reclaimId,
          });
          assert.equal(status.status, 'READY');
        });

        // Live lease owned by another worker must not be stolen before expiry.
        let liveId;
        await withTenant(db, tenantId, async (tx) => {
          const job = await createExportJob(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            clientKey: 'exp-live-lease',
            filter: { states: ['ACTIVE'] },
            ttlSeconds: 3600,
          });
          liveId = job.exportId;
          await tx.$executeRaw`
            UPDATE exports
            SET status = 'PROCESSING',
                lease_owner = 'owner-live',
                lease_expires_at = now() + interval '10 minutes',
                updated_at = now()
            WHERE tenant_id = ${tenantId}::uuid AND id = ${liveId}::uuid
          `;
        });
        const stolen = await relayExportsOnce(db, minioEnv, 'worker-thief', 5);
        assert.equal(
          stolen.claimed,
          0,
          'live unexpired lease must not be claimed',
        );
        await processExportJob(
          db,
          minio.cfg,
          tenantId,
          liveId,
          3600,
          'worker-thief',
        );
        await withTenant(db, tenantId, async (tx) => {
          const after = await tx.$queryRaw`
            SELECT status, lease_owner
            FROM exports
            WHERE tenant_id = ${tenantId}::uuid AND id = ${liveId}::uuid
          `;
          assert.equal(after[0].status, 'PROCESSING');
          assert.equal(after[0].lease_owner, 'owner-live');
        });
        // Legitimate owner can finish.
        await processExportJob(
          db,
          minio.cfg,
          tenantId,
          liveId,
          3600,
          'owner-live',
        );
        await withTenant(db, tenantId, async (tx) => {
          const done = await getExportJob(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            exportId: liveId,
          });
          assert.equal(done.status, 'READY');
        });
      }

      const token = 'device-token-abcdef123456';
      const reg = await registerDeviceToken(db, {
        userId: attendee.userId,
        token,
        environment: 'sandbox',
      });
      assert.ok(reg.registrationId);
      assert.ok(reg.registeredAt);

      // Account switch: same device token moves to another user; old owner loses it.
      const switched = await registerDeviceToken(db, {
        userId: manager.userId,
        token,
        environment: 'production',
      });
      assert.notEqual(switched.registrationId, reg.registrationId);
      await assert.rejects(
        () =>
          revokeDeviceToken(db, {
            userId: attendee.userId,
            registrationId: reg.registrationId,
          }),
        (e) => e.code === 'REGISTRATION_NOT_FOUND',
      );
      // Late logout of previous owner cannot revoke the new owner's registration.
      await assert.rejects(
        () =>
          revokeDeviceToken(db, {
            userId: attendee.userId,
            registrationId: switched.registrationId,
          }),
        (e) => e.code === 'REGISTRATION_NOT_FOUND',
      );
      await revokeDeviceToken(db, {
        userId: manager.userId,
        registrationId: switched.registrationId,
      });
      await assert.rejects(
        () =>
          registerDeviceToken(db, {
            userId: attendee.userId,
            token: null,
            environment: 'sandbox',
          }),
        (e) => e.code === 'TOKEN_REQUIRED',
      );

      // --- revoked membership → export status/download denied ---
      await withTenant(db, tenantId, async (tx) => {
        await revokeMembership(tx, tenantId, csMembershipId);
        await assert.rejects(
          () =>
            getExportJob(tx, {
              tenantId,
              eventId,
              actorUserId: cs.userId,
              exportId,
            }),
          (e) => e instanceof AuthzError,
        );
      });
      await assert.rejects(
        () =>
          downloadExport(db, minio.cfg, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            exportId,
          }),
        (e) => e instanceof AuthzError,
      );

      // Reactivate same membership/assignment rows (tenant+user unique).
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE memberships
          SET revoked_at = NULL, activated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${csMembershipId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE event_assignments
          SET revoked_at = NULL, activated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND membership_id = ${csMembershipId}::uuid
        `;
      });

      // --- resend cooldown + hourly cap ---
      await withTenant(db, tenantId, async (tx) => {
        await assert.rejects(
          () =>
            resendTicketEmail(tx, {
              tenantId,
              eventId,
              actorUserId: cs.userId,
              ticketId: ticket.ticketId,
              clientKey: 'resend-cooldown',
            }),
          (e) => e.code === 'RESEND_COOLDOWN',
        );
        // Force-clear cooldown window by backdating audits, then hit hourly cap.
        await tx.$executeRaw`
          UPDATE audit_logs
          SET created_at = now() - interval '2 minutes'
          WHERE tenant_id = ${tenantId}::uuid
            AND action = 'ticket.email_resend'
        `;
        // Already 1 audit from earlier resend; add 9 more → 10, then overflow.
        for (let i = 0; i < 9; i++) {
          await resendTicketEmail(tx, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            ticketId: ticket.ticketId,
            clientKey: 'resend-cap-' + i,
          });
          await tx.$executeRaw`
            UPDATE audit_logs
            SET created_at = now() - interval '2 minutes'
            WHERE tenant_id = ${tenantId}::uuid
              AND action = 'ticket.email_resend'
          `;
        }
        await assert.rejects(
          () =>
            resendTicketEmail(tx, {
              tenantId,
              eventId,
              actorUserId: cs.userId,
              ticketId: ticket.ticketId,
              clientKey: 'resend-cap-overflow',
            }),
          (e) => e.code === 'RESEND_LIMIT',
        );
      });

      // --- export expiry ---
      let expiredId;
      await withTenant(db, tenantId, async (tx) => {
        const job = await createExportJob(tx, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          clientKey: 'exp-expired',
          filter: { states: ['ACTIVE'] },
          ttlSeconds: 3600,
        });
        expiredId = job.exportId;
      });
      await processExportJob(db, minio.cfg, tenantId, expiredId, 3600);
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE exports
          SET expires_at = now() - interval '1 minute'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${expiredId}::uuid
        `;
      });
      await assert.rejects(
        () =>
          downloadExport(db, minio.cfg, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            exportId: expiredId,
          }),
        (e) => e instanceof ExportError && e.code === 'EXPORT_EXPIRED',
      );

      // --- concurrent register / reassign / stale DELETE ---
      const shared = 'concurrent-token-xyz-12345';
      const [a, b] = await Promise.all([
        registerDeviceToken(db, {
          userId: attendee.userId,
          token: shared,
          environment: 'sandbox',
        }),
        registerDeviceToken(db, {
          userId: manager.userId,
          token: shared,
          environment: 'production',
        }),
      ]);
      const active = await listActiveDeviceTokensForUser(db, manager.userId);
      const activeAttendee = await listActiveDeviceTokensForUser(
        db,
        attendee.userId,
      );
      // Exactly one active owner for the physical token.
      const owners = [...active, ...activeAttendee].filter(
        (r) => r.token === shared,
      );
      assert.equal(owners.length, 1);
      const winner = owners[0];
      const winnerIsAttendee = activeAttendee.some((r) => r.id === winner.id);
      const loserUserId = winnerIsAttendee ? manager.userId : attendee.userId;
      // Stale DELETE by non-owner cannot revoke the winner registration.
      await assert.rejects(
        () =>
          revokeDeviceToken(db, {
            userId: loserUserId,
            registrationId: winner.id,
          }),
        (e) => e.code === 'REGISTRATION_NOT_FOUND',
      );
      // Stale id from the lost race is not deletable by either party as active.
      const staleId =
        a.registrationId === winner.id ? b.registrationId : a.registrationId;
      await assert.rejects(
        () =>
          revokeDeviceToken(db, {
            userId: attendee.userId,
            registrationId: staleId,
          }),
        (e) => e.code === 'REGISTRATION_NOT_FOUND',
      );
      void a;
      void b;

      // SMTP/APNs: no active devices → email path COMPLETE even when APNs unset.
      // Clear attendee devices first so drain/email can COMPLETE with apns unset.
      {
        const leftover = await listActiveDeviceTokensForUser(
          db,
          attendee.userId,
        );
        for (const row of leftover) {
          await revokeDeviceToken(db, {
            userId: attendee.userId,
            registrationId: row.id,
          });
        }
        assert.equal(
          (await listActiveDeviceTokensForUser(db, attendee.userId)).length,
          0,
        );
      }
      await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'test-worker-drain',
        20,
        { apns: null, credentialKeyMaterial: CREDENTIAL_KEY },
      );
      const outboxNoDevice = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${outboxNoDevice}::uuid,
            'TicketIssued', ${ticket.ticketId}::uuid, 1,
            ${JSON.stringify({
              ticketId: ticket.ticketId,
              ownerUserId: attendee.userId,
              email: 'attendee@example.com',
              eventId,
              businessKey: 'ticket:' + ticket.ticketId + ':issued:email:nodev',
            })}::jsonb,
            'PENDING', 0, now(), now()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, state,
            attempts, payload, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid,
            ${'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}::uuid,
            ${'ticket:' + ticket.ticketId + ':issued:email:nodev'},
            'email', 'PENDING', 0, '{}'::jsonb, now(), now()
          )
        `;
      });
      const completedNoPush = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'test-worker-nodev',
        5,
        { apns: null, credentialKeyMaterial: CREDENTIAL_KEY },
      );
      assert.equal(
        completedNoPush.failed,
        0,
        'no-device path must not fail-closed',
      );
      assert.ok(completedNoPush.completed >= 1);
      await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid AND id = ${outboxNoDevice}::uuid
        `;
        assert.equal(rows[0].status, 'COMPLETE');
      });

      // --- APNs fail-closed when tokens exist but adapter missing ---
      const pushToken = 'apns-failclosed-token-001';
      await registerDeviceToken(db, {
        userId: attendee.userId,
        token: pushToken,
        environment: 'sandbox',
      });
      // Insert a TicketIssued outbox row pointing at attendee.
      const outboxId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${outboxId}::uuid,
            'TicketIssued', ${ticket.ticketId}::uuid, 1,
            ${JSON.stringify({
              ticketId: ticket.ticketId,
              ownerUserId: attendee.userId,
              email: 'attendee@example.com',
              eventId,
              businessKey: 'ticket:' + ticket.ticketId + ':issued:email:test',
            })}::jsonb,
            'PENDING', 0, now(), now()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, state,
            attempts, payload, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}::uuid,
            ${'ticket:' + ticket.ticketId + ':issued:email:test'},
            'email', 'PENDING', 0, '{}'::jsonb, now(), now()
          )
        `;
      });
      const failClosed = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'test-worker',
        5,
        { apns: null, credentialKeyMaterial: CREDENTIAL_KEY },
      );
      assert.ok(failClosed.failed >= 1);

      // APNs invalid token is terminal for that required device delivery.
      const invalidAdapter = {
        async send() {
          return {
            ok: false,
            providerStatus: 'FAILED',
            reason: 'BadDeviceToken',
            invalidateToken: true,
            retryable: false,
          };
        },
      };
      // Reset outbox to PENDING for retry with invalid adapter
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET status = 'PENDING', lease_owner = NULL,
            lease_expires_at = NULL, next_attempt_at = now()
          WHERE tenant_id = ${tenantId}::uuid AND id = ${outboxId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE notifications SET state = 'PENDING'
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + ticket.ticketId + ':issued:email:test'}
        `;
        await tx.$executeRaw`
          UPDATE notifications SET next_attempt_at = clock_timestamp()
          WHERE tenant_id = ${tenantId}::uuid AND channel = 'push'
            AND business_key LIKE ${'ticket:' + ticket.ticketId + ':issued:push:%'}
        `;
      });
      const invalidated = await relayOutboxOnce(
        db,
        createNoopEmailAdapter(),
        'test-worker-2',
        5,
        { apns: invalidAdapter, credentialKeyMaterial: CREDENTIAL_KEY },
      );
      assert.ok(invalidated.failed >= 1);
      const deadOutbox = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid
            AND id = ${outboxId}::uuid
        `;
        return rows[0].status;
      });
      assert.equal(deadOutbox, 'DEAD');
      const still = await listActiveDeviceTokensForUser(db, attendee.userId);
      assert.ok(!still.some((r) => r.token === pushToken));

      // PostgreSQL keeps six fractional digits even though JS Date keeps three.
      // Clone the issued request/ticket under the runtime role to reproduce #990.
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE tickets SET created_at = '2026-10-26 17:14:16.465788+00'::timestamptz
          WHERE tenant_id = ${tenantId}::uuid AND id = ${ticket.ticketId}::uuid
        `;
        await tx.$executeRaw`
          INSERT INTO redemption_requests (
            tenant_id, event_id, id, actor_user_id, redemption_code_id,
            status, form_version, terms_version, created_at, updated_at
          )
          SELECT r.tenant_id, r.event_id, md5('cs-page-request-' || n)::uuid,
                 r.actor_user_id, r.redemption_code_id, r.status,
                 r.form_version, r.terms_version, r.created_at, r.updated_at
          FROM redemption_requests r CROSS JOIN generate_series(1, 29) AS n
          WHERE r.tenant_id = ${tenantId}::uuid AND r.id = (
            SELECT request_id FROM tickets
            WHERE tenant_id = ${tenantId}::uuid AND id = ${ticket.ticketId}::uuid
          )
        `;
        await tx.$executeRaw`
          INSERT INTO tickets (
            tenant_id, event_id, id, owner_user_id, ticket_type_id,
            source_id, request_id, state, credential_version,
            entitlement_snapshot, created_at, updated_at
          )
          SELECT t.tenant_id, t.event_id, md5('cs-page-ticket-' || n)::uuid,
                 t.owner_user_id, t.ticket_type_id, t.source_id,
                 md5('cs-page-request-' || n)::uuid, t.state,
                 t.credential_version, t.entitlement_snapshot,
                 '2026-10-26 17:14:16.465788+00'::timestamptz, t.updated_at
          FROM tickets t CROSS JOIN generate_series(1, 29) AS n
          WHERE t.tenant_id = ${tenantId}::uuid AND t.id = ${ticket.ticketId}::uuid
        `;
      });

      const seen = [];
      let cursor;
      let firstPage;
      for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
        const page = await withTenant(db, tenantId, (tx) =>
          listCsTickets(tx, HMAC, {
            tenantId,
            eventId,
            actorUserId: cs.userId,
            limit: 10,
            cursor,
          }),
        );
        if (!firstPage) firstPage = page;
        assert.equal(page.items.length, 10);
        seen.push(...page.items.map((item) => item.ticketId));
        assert.deepEqual(
          page.items.map((item) => item.ticketId),
          [...page.items.map((item) => item.ticketId)].sort().reverse(),
        );
        cursor = page.nextCursor;
        assert.equal(Boolean(cursor), pageNumber < 2);
      }
      assert.equal(new Set(seen).size, 30);
      assert.equal(seen.includes(ticket.ticketId), true);
      const [version, timestamp, anchorId] = Buffer.from(
        firstPage.nextCursor,
        'base64url',
      )
        .toString('utf8')
        .split('|');
      assert.equal(version, 'v1');
      assert.equal(timestamp, '2026-10-26T17:14:16.465788Z');
      const legacyCursor = Buffer.from(
        `2026-10-26T17:14:16.465Z|${anchorId}`,
      ).toString('base64url');
      const legacyPage = await withTenant(db, tenantId, (tx) =>
        listCsTickets(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          limit: 10,
          cursor: legacyCursor,
        }),
      );
      assert.deepEqual(
        legacyPage.items.map((item) => item.ticketId),
        seen.slice(10, 20),
      );
      const invalidPage = await withTenant(db, tenantId, (tx) =>
        listCsTickets(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          limit: 10,
          cursor: 'not-a-cursor',
        }),
      );
      assert.deepEqual(invalidPage.items, firstPage.items);
      const invalidVersionedPage = await withTenant(db, tenantId, (tx) =>
        listCsTickets(tx, HMAC, {
          tenantId,
          eventId,
          actorUserId: cs.userId,
          limit: 10,
          cursor: Buffer.from(`v1|bad-time|${anchorId}`).toString('base64url'),
        }),
      );
      assert.deepEqual(invalidVersionedPage.items, firstPage.items);
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            listCsTickets(tx, HMAC, {
              tenantId,
              eventId: randomUUID(),
              actorUserId: cs.userId,
              cursor: firstPage.nextCursor,
            }),
          ),
        (error) => error instanceof AuthzError,
      );
      const otherTenantId = randomUUID();
      await assert.rejects(
        () =>
          withTenant(db, otherTenantId, (tx) =>
            listCsTickets(tx, HMAC, {
              tenantId: otherTenantId,
              eventId,
              actorUserId: cs.userId,
              cursor: legacyCursor,
            }),
          ),
        (error) => error instanceof AuthzError,
      );

      // O06 admission reserves the TTL plus 24 hours before the day-90 deadline.
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET ends_at = clock_timestamp() - interval '89 days'
          + interval '1 hour 10 seconds'
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);
      const pending = await withTenant(db, tenantId, (tx) => createExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId,
        clientKey: 'o06-before-cutoff', ttlSeconds: 3600,
      }));
      const readyBeforeCutoff = await withTenant(db, tenantId, (tx) => createExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId,
        clientKey: 'o06-ready-before-cutoff', ttlSeconds: 3600,
      }));
      await processExportJob(db, minio.cfg, tenantId, readyBeforeCutoff.exportId, 3600);
      const readyExpiry = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
        SELECT x.status, x.expires_at, e.ends_at + interval '89 days' AS latest_expiry
        FROM exports x JOIN events e ON e.tenant_id=x.tenant_id AND e.id=x.event_id
        WHERE x.tenant_id=${tenantId}::uuid AND x.id=${readyBeforeCutoff.exportId}::uuid
      `);
      assert.equal(readyExpiry[0].status, 'READY');
      assert.ok(readyExpiry[0].expires_at <= readyExpiry[0].latest_expiry,
        'new READY download TTL must end before the day-89 purge window');
      const preparedAtCutoff = await withTenant(db, tenantId, (tx) => createExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId,
        clientKey: 'o06-prepared-at-cutoff', ttlSeconds: 3600,
      }));
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET ends_at = clock_timestamp() - interval '89 days'
          + interval '59 minutes 50 seconds'
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);
      await assert.rejects(
        withTenant(db, tenantId, (tx) => createExportJob(tx, {
          tenantId, eventId, actorUserId: cs.userId,
          clientKey: 'o06-at-cutoff', ttlSeconds: 3600,
        })),
        (error) => error instanceof ExportError && error.code === 'EXPORT_EXPIRED',
      );
      const nearCutoffRelay = await relayExportsOnce(db, {
        MINIO_ENDPOINT: minio.cfg.endpoint, MINIO_ACCESS_KEY: minio.cfg.accessKey,
        MINIO_SECRET_KEY: minio.cfg.secretKey, MINIO_BUCKET: minio.cfg.bucket,
        MINIO_EXPORTS_ACCESS_KEY: minio.cfg.accessKey, MINIO_EXPORTS_SECRET_KEY: minio.cfg.secretKey,
        MINIO_BUCKET_EXPORTS: minio.cfg.bucket,
        EXPORT_TTL_SECONDS: '3600',
      }, 'o06-near-cutoff-worker', 5);
      assert.equal(nearCutoffRelay.claimed, 0, 'claim uses the same 24-hour buffer');
      await processExportJob(db, minio.cfg, tenantId, preparedAtCutoff.exportId, 3600);
      const cutoffJob = await withTenant(db, tenantId, (tx) => getExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId,
        exportId: preparedAtCutoff.exportId,
      }));
      assert.equal(cutoffJob.status, 'FAILED');
      assert.equal(cutoffJob.error, 'EXPORT_EXPIRED');
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET ends_at = clock_timestamp() - interval '91 days'
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);
      const dueRelay = await relayExportsOnce(db, {
        MINIO_ENDPOINT: minio.cfg.endpoint, MINIO_ACCESS_KEY: minio.cfg.accessKey,
        MINIO_SECRET_KEY: minio.cfg.secretKey, MINIO_BUCKET: minio.cfg.bucket,
        MINIO_EXPORTS_ACCESS_KEY: minio.cfg.accessKey, MINIO_EXPORTS_SECRET_KEY: minio.cfg.secretKey,
        MINIO_BUCKET_EXPORTS: minio.cfg.bucket,
        EXPORT_TTL_SECONDS: '3600',
      }, 'o06-worker', 5);
      assert.equal(dueRelay.claimed, 0, 'past-cutoff event cannot be claimed');
      await processExportJob(db, minio.cfg, tenantId, pending.exportId, 3600);
      const failed = await withTenant(db, tenantId, (tx) => getExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId, exportId: pending.exportId,
      }));
      assert.equal(failed.status, 'FAILED');
      assert.equal(failed.error, 'EXPORT_EXPIRED');
      // A pre-migration READY row may have an old TTL beyond the retention limit.
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE exports SET expires_at = clock_timestamp() + interval '3 days'
        WHERE tenant_id = ${tenantId}::uuid AND id = ${expiredId}::uuid
      `);
      await assert.rejects(
        () => downloadExport(db, minio.cfg, {
          tenantId, eventId, actorUserId: cs.userId, exportId: expiredId,
        }),
        (error) => error instanceof ExportError && error.code === 'EXPORT_EXPIRED',
      );
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE events SET business_status = 'CANCELLED',
          cancelled_at = clock_timestamp() - interval '100 days', ends_at = NULL
        WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      `);
      const noEnd = await withTenant(db, tenantId, (tx) => createExportJob(tx, {
        tenantId, eventId, actorUserId: cs.userId,
        clientKey: 'o06-cancelled-null-end', ttlSeconds: 3600,
      }));
      assert.equal(noEnd.status, 'PENDING');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (minio) await minio.close();
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
