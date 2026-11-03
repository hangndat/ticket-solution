// DB-19 — key/pepper rotation for redemption-code routing.
//
// AC: codes issued under an old pepper that is still within its rotation
// lifetime must keep resolving after a new pepper becomes current; a code
// whose pepper version is no longer supported must fail closed; and the raw
// code material must never be stored. Exercises the DB routing alias path
// (backfill) with a real PostgreSQL container, not just the pure hashing unit.
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
  seedEventInventory,
  backfillCodeRoutingFromRedemptionCodes,
  lookupRoutableTarget,
  readCodeHmacEnvironment,
  readSupportedPepperConfigs,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  IssueError,
  ISSUE_ERROR_CODES,
  readCredentialKeyringEnvironment,
  sealCredentialToken,
  openCurrentCredentialForQr,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const PEPPER_V1 = 'db19-pepper-v1-16bytes-min!';
const PEPPER_V2 = 'db19-pepper-v2-16bytes-min!';
const CRED_KEY = 'db19-credential-key-material';
const CRED_KEY_V2 = 'db19-credential-key-material-v2';

async function startIsolatedPostgres() {
  const name = 'ticket-db19-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_2427dc28858c',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db19_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'db19_test');
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/db19_test',
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
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE db19_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO db19_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://db19_login:' + password + '@127.0.0.1:' + port + '/db19_test',
  };
}

test(
  'DB-19: code issued under v1 keeps resolving after v2 rotation; removed v1 fails closed; no plaintext',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);

      const hmacV1 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: PEPPER_V1,
        CODE_HMAC_VERSION: '1',
      });

      const users = createPrismaIdentityUserRepository(db);
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'db19-manager',
        email: 'db19-manager@example.com',
        emailVerified: true,
      });

      const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db19-rotation', name: 'Rotation' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'db19-event',
            name: 'Rotation Event',
            status: 'PUBLISHED',
            contentStatus: 'PUBLISHED',
            businessStatus: 'ACTIVE',
          },
        });
        await seedEventInventory(tx, hmacV1, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['ROTATE-1'],
        });
        const backfill = await backfillCodeRoutingFromRedemptionCodes(tx);
        assert.equal(backfill.candidates, 1);
      });

      // Baseline: code resolves under the pepper version it was issued with.
      const targetV1 = await withTenant(db, tenantId, (tx) =>
        lookupRoutableTarget(tx, [hmacV1], 'ROTATE-1'),
      );
      assert.equal(targetV1.tenantId, tenantId);
      assert.equal(targetV1.eventId, eventId);

      // Rotation: v2 becomes current, v1 retained in legacy ring.
      const peppersV1V2 = readSupportedPepperConfigs({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
        CODE_HMAC_LEGACY_PEPPERS: JSON.stringify({ '1': PEPPER_V1 }),
      });
      assert.equal(peppersV1V2.length, 2);
      assert.deepEqual(
        peppersV1V2.map((c) => c.version),
        [1, 2],
      );
      const targetRotated = await withTenant(db, tenantId, (tx) =>
        lookupRoutableTarget(tx, peppersV1V2, 'ROTATE-1'),
      );
      assert.equal(targetRotated.codeId, targetV1.codeId);

      // Fail-closed: once v1 is removed from the ring, the old code is unknown.
      const peppersV2Only = readSupportedPepperConfigs({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
      });
      assert.equal(peppersV2Only.length, 1);
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            lookupRoutableTarget(tx, peppersV2Only, 'ROTATE-1'),
          ),
        (e) => e instanceof IssueError && e.code === ISSUE_ERROR_CODES.CODE_INVALID,
      );

      // No plaintext material stored: code_hmac differs from the raw code and
      // the stored pepper version matches the issuing config.
      const stored = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT code_hmac, code_pepper_version
          FROM redemption_codes
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `,
      );
      assert.equal(stored.length, 1);
      assert.equal(Number(stored[0].code_pepper_version), 1);
      assert.notEqual(stored[0].code_hmac, 'ROTATE-1');
      assert.doesNotMatch(stored[0].code_hmac, /ROTATE-1/i);
      void manager;
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore cleanup races */
        }
      }
    }
  },
);

test(
  'DB-19: consumed code cannot be re-issued after pepper rotation (fail-closed)',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);

      const hmacV1 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: PEPPER_V1,
        CODE_HMAC_VERSION: '1',
      });

      const users = createPrismaIdentityUserRepository(db);
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'db19-guest',
        email: 'db19-guest@example.com',
        emailVerified: true,
      });

      const tenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db19-consumed', name: 'Consumed' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'db19-consumed-event',
            name: 'Consumed Event',
            status: 'PUBLISHED',
            contentStatus: 'PUBLISHED',
            businessStatus: 'ACTIVE',
          },
        });
        await seedEventInventory(tx, hmacV1, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['ROTATE-USED'],
        });
        const backfill = await backfillCodeRoutingFromRedemptionCodes(tx);
        assert.equal(backfill.candidates, 1);
      });

      // Issue the code under v1 → redemption_codes.status becomes CONSUMED.
      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, hmacV1, CRED_KEY, {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'ROTATE-USED',
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      assert.equal(issued.state, 'ACTIVE');

      // The persisted kid selects the old key after rotation. Removing that
      // key or revoking the row must never resurrect an admissible credential.
      const credentials = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
        SELECT kid, token_hash, encrypted_token, status
        FROM ticket_credentials
        WHERE tenant_id=${tenantId}::uuid AND ticket_id=${issued.ticketId}::uuid
      `);
      assert.equal(credentials.length, 1);
      const oldCredential = credentials[0];
      assert.equal(oldCredential.kid, 'local-v1');
      assert.equal(oldCredential.status, 'ACTIVE');
      const rotatedRing = readCredentialKeyringEnvironment({
        TICKET_CREDENTIAL_KEY: CRED_KEY_V2,
        TICKET_CREDENTIAL_KID: 'local-v2',
        TICKET_CREDENTIAL_LEGACY_KEYS: JSON.stringify({ 'local-v1': CRED_KEY }),
      });
      const opened = openCurrentCredentialForQr({
        encryptedToken: oldCredential.encrypted_token,
        expectedTokenHash: oldCredential.token_hash,
        kid: oldCredential.kid,
        credentialKeyMaterial: rotatedRing,
      });
      assert.equal(opened.tokenHash, oldCredential.token_hash);
      assert.equal(sealCredentialToken('new-token', rotatedRing).kid, 'local-v2');
      for (const ring of [
        readCredentialKeyringEnvironment({ TICKET_CREDENTIAL_KEY: CRED_KEY_V2, TICKET_CREDENTIAL_KID: 'local-v2' }),
        { currentKid: 'local-v2', keys: { 'local-v2': CRED_KEY_V2, 'local-v1': 'wrong-old-key-material' } },
      ]) {
        assert.throws(() => openCurrentCredentialForQr({
          encryptedToken: oldCredential.encrypted_token,
          expectedTokenHash: oldCredential.token_hash,
          kid: oldCredential.kid,
          credentialKeyMaterial: ring,
        }));
      }
      assert.throws(() => readCredentialKeyringEnvironment({
        TICKET_CREDENTIAL_KEY: CRED_KEY_V2,
        TICKET_CREDENTIAL_KID: 'local-v2',
        TICKET_CREDENTIAL_LEGACY_KEYS: JSON.stringify({ 'local-v2': CRED_KEY }),
      }), /invalid/);
      await withTenant(db, tenantId, (tx) => tx.$executeRaw`
        UPDATE ticket_credentials SET status='REVOKED'
        WHERE tenant_id=${tenantId}::uuid AND ticket_id=${issued.ticketId}::uuid
      `);
      const active = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
        SELECT kid FROM ticket_credentials
        WHERE tenant_id=${tenantId}::uuid AND ticket_id=${issued.ticketId}::uuid
          AND status='ACTIVE'
      `);
      assert.equal(active.length, 0);

      // Same pepper: a consumed code is rejected with CODE_CONSUMED, never
      // re-issued into a second ticket.
      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, hmacV1, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'ROTATE-USED',
              idempotencyKey: randomUUID(),
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (e) =>
          e instanceof IssueError &&
          e.code === ISSUE_ERROR_CODES.CODE_CONSUMED,
      );

      // Rotate v1→v2. With the ring not yet carrying v1 (legacy peppers not
      // configured), the v1-hashed row is invisible to the current-only
      // lookup — fails closed as CODE_INVALID, not a false CODE_CONSUMED.
      const hmacV2 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
      });
      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, hmacV2, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'ROTATE-USED',
              idempotencyKey: randomUUID(),
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (e) =>
          e instanceof IssueError && e.code === ISSUE_ERROR_CODES.CODE_INVALID,
      );

      // Same rotation, but with v1 retained in the legacy pepper ring: the
      // v1-hashed row resolves again and must be reported as CODE_CONSUMED
      // specifically — rotation must not resurrect it into a second ticket.
      const pepperRing = readSupportedPepperConfigs({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
        CODE_HMAC_LEGACY_PEPPERS: JSON.stringify({ '1': PEPPER_V1 }),
      });
      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, hmacV2, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'ROTATE-USED',
              idempotencyKey: randomUUID(),
              routingPeppers: pepperRing,
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (e) =>
          e instanceof IssueError &&
          e.code === ISSUE_ERROR_CODES.CODE_CONSUMED,
      );

      // Invariant: exactly one ticket exists; rotation never resurrected the code.
      const ticketCount = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `,
      );
      assert.equal(Number(ticketCount[0].n), 1);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore cleanup races */
        }
      }
    }
  },
);

test(
  'DB-19: duplicate rows for the same raw code across a pepper rotation fail closed with zero mutation',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);

      const hmacV1 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: PEPPER_V1,
        CODE_HMAC_VERSION: '1',
      });
      const hmacV2 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
      });

      const users = createPrismaIdentityUserRepository(db);
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'db19-ambiguous-guest',
        email: 'db19-ambiguous@example.com',
        emailVerified: true,
      });

      const tenantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db19-ambiguous', name: 'Ambiguous' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'db19-ambiguous-event',
            name: 'Ambiguous Event',
            status: 'PUBLISHED',
            contentStatus: 'PUBLISHED',
            businessStatus: 'ACTIVE',
          },
        });
        // Residual duplicate: same raw code re-imported across a pepper
        // rotation without the DB-10 routing registry (no global fingerprint
        // to reject the re-insert) — two rows, different code_hmac/version,
        // same tenant/event, different source/ticket type.
        await seedEventInventory(tx, hmacV1, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['DUP-ROW'],
          ticketTypeLabel: 'General-V1',
          sourceName: 'Import-V1',
        });
        await seedEventInventory(tx, hmacV2, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['DUP-ROW'],
          ticketTypeLabel: 'General-V2',
          sourceName: 'Import-V2',
        });
      });

      const pepperRing = readSupportedPepperConfigs({
        CODE_HMAC_PEPPER: PEPPER_V2,
        CODE_HMAC_VERSION: '2',
        CODE_HMAC_LEGACY_PEPPERS: JSON.stringify({ '1': PEPPER_V1 }),
      });

      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, hmacV2, CRED_KEY, {
              tenantId,
              eventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'DUP-ROW',
              idempotencyKey: randomUUID(),
              routingPeppers: pepperRing,
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (e) =>
          e instanceof IssueError && e.code === ISSUE_ERROR_CODES.CODE_INVALID,
      );

      // Zero mutation: no ticket, no outbox entry, quota untouched, and both
      // ambiguous rows remain AVAILABLE — rejected before any write.
      const [tickets, outboxRows, codes, quotas] = await withTenant(
        db,
        tenantId,
        async (tx) => [
          await tx.$queryRaw`
            SELECT COUNT(*)::int AS n FROM tickets
            WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          `,
          await tx.$queryRaw`
            SELECT COUNT(*)::int AS n FROM outbox
            WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          `,
          await tx.$queryRaw`
            SELECT status, active_request_id FROM redemption_codes
            WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
            ORDER BY code_pepper_version
          `,
          await tx.$queryRaw`
            SELECT COALESCE(SUM(allocated), 0)::int AS n FROM quota_buckets
            WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          `,
        ],
      );
      assert.equal(Number(tickets[0].n), 0);
      assert.equal(Number(outboxRows[0].n), 0);
      assert.equal(codes.length, 2);
      for (const row of codes) {
        assert.equal(row.status, 'AVAILABLE');
        assert.equal(row.active_request_id, null);
      }
      assert.equal(Number(quotas[0].n), 0);

      // Guard rail: a single legitimate old-pepper code (no duplicate row)
      // still resolves normally through the same ring, and once consumed
      // stays denied — the new ambiguity guard must not regress the
      // existing single-row rotation path.
      const singleEventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.event.create({
          data: {
            tenantId,
            id: singleEventId,
            slug: 'db19-ambiguous-single-event',
            name: 'Single Row Event',
            status: 'PUBLISHED',
            contentStatus: 'PUBLISHED',
            businessStatus: 'ACTIVE',
          },
        });
        await seedEventInventory(tx, hmacV1, {
          tenantId,
          eventId: singleEventId,
          eventQuota: 2,
          rawCodes: ['SINGLE-ROW'],
        });
      });
      const singleIssued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, hmacV2, CRED_KEY, {
            tenantId,
            eventId: singleEventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'SINGLE-ROW',
            idempotencyKey: randomUUID(),
            routingPeppers: pepperRing,
          }),
        ),
      );
      assert.equal(singleIssued.state, 'ACTIVE');

      await assert.rejects(
        async () => {
          const outcome = await withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(tx, hmacV2, CRED_KEY, {
              tenantId,
              eventId: singleEventId,
              actorUserId: guest.userId,
              actorEmail: guest.email,
              emailVerified: true,
              rawCode: 'SINGLE-ROW',
              idempotencyKey: randomUUID(),
              routingPeppers: pepperRing,
            }),
          );
          unwrapRedeemOutcome(outcome);
        },
        (e) =>
          e instanceof IssueError && e.code === ISSUE_ERROR_CODES.CODE_CONSUMED,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore cleanup races */
        }
      }
    }
  },
);
