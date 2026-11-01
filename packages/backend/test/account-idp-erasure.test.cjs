'use strict';

/**
 * D13 SEC-2: IdP DELETE + tombstone denylist + COMPLETED iff PG+IdP.
 * Isolated Docker Postgres; fake IdP adapter for fault matrix (T4–T15).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const jose = require('jose');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  createAccountDeletionRequest,
  processDueAccountAnonymizations,
  registerDeviceToken,
  listActiveDeviceTokensForUser,
  createFakeKeycloakErasureAdapter,
  readTombstoneKeyring,
  createOidcVerifier,
  createLocalJwks,
  IdentityError,
  IDENTITY_ERROR_CODES,
  IDP_ERROR_CODES,
  isUuidSubject,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const ISSUER = 'http://127.0.0.1:8080/realms/ticket';

function tombstoneEnv(extra = {}) {
  return {
    OIDC_ISSUER: ISSUER,
    ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k1',
    ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
      {
        keyId: 'k1',
        secretBase64: Buffer.alloc(32, 11).toString('base64'),
      },
      {
        keyId: 'k0',
        secretBase64: Buffer.alloc(32, 12).toString('base64'),
      },
    ]),
    ...extra,
  };
}

async function startIsolatedPostgres() {
  const name = 'ticket-d13-idp-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d13_idp',
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
        'd13_idp',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'task database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d13_idp',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
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
    for (const file of MIGRATIONS) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d13_idp_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d13_idp_login');
    return {
      name,
      url:
        'postgresql://d13_idp_login:' +
        password +
        '@127.0.0.1:' +
        port +
        '/d13_idp',
      adminUrl:
        'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d13_idp',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

async function seedUser(db, subject) {
  const users = createPrismaIdentityUserRepository(db, {
    env: tombstoneEnv(),
  });
  return users.upsertFromVerifiedIdentity({
    issuer: ISSUER,
    subject,
    email: subject + '@example.com',
    emailVerified: true,
  });
}

function opts(idpHandler, env = tombstoneEnv()) {
  return {
    env,
    leaseOwner: 'sec2-' + randomUUID().slice(0, 8),
    keyring: readTombstoneKeyring(env),
    idp: createFakeKeycloakErasureAdapter({
      deleteUserBySubject: idpHandler,
    }),
  };
}

test(
  'SEC-2 T4/T14: DELETE → COMPLETED; originals scrubbed; digest retained',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const sub = randomUUID();
      const user = await seedUser(db, sub);
      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const processed = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 1);

      const row = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status,
               out_original_issuer AS original_issuer,
               out_original_subject AS original_subject,
               out_pg_applied_at IS NOT NULL AS pg_ok
        FROM get_account_deletion_idp_row(${del.requestId}::uuid)
      `;
      assert.equal(row[0].state, 'COMPLETED');
      assert.equal(row[0].idp_status, 'DELETED');
      assert.equal(row[0].original_issuer, null);
      assert.equal(row[0].original_subject, null);
      assert.equal(row[0].pg_ok, true);
      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      const digAdmin = await admin.query(
        `SELECT subject_tombstone_digest IS NOT NULL AS has_digest
         FROM account_deletion_requests WHERE id = $1`,
        [del.requestId],
      );
      assert.equal(digAdmin.rows[0].has_digest, true);
      await admin.end();
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

async function parkOpenRequests(adminUrl, exceptId) {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(
    `UPDATE account_deletion_requests
     SET idp_next_attempt_at = clock_timestamp() + interval '7 days'
     WHERE state = 'REQUESTED' AND ($1::uuid IS NULL OR id <> $1)`,
    [exceptId ?? null],
  );
  await admin.end();
}

test(
  'SEC-2 T5: NOT_FOUND → COMPLETED',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const u5 = await seedUser(db, randomUUID());
      const d5 = await createAccountDeletionRequest(db, {
        userId: u5.userId,
        confirmation: true,
      });
      const p5 = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'NOT_FOUND' })),
      );
      assert.equal(p5.completed, 1);
      const r5 = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status
        FROM get_account_deletion_idp_row(${d5.requestId}::uuid)
      `;
      assert.equal(r5[0].state, 'COMPLETED');
      assert.equal(r5[0].idp_status, 'NOT_FOUND');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'SEC-2 T6/T7/T8: path404/disable stay REQUESTED; 503 then DELETE completes',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);

      const u6 = await seedUser(db, randomUUID());
      const d6 = await createAccountDeletionRequest(db, {
        userId: u6.userId,
        confirmation: true,
      });
      const p6 = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_PATH_404,
          retryable: false,
        })),
      );
      assert.equal(p6.completed, 0);
      assert.equal(p6.applied, 1);
      const r6 = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status,
               out_idp_last_error_code AS idp_last_error_code
        FROM get_account_deletion_idp_row(${d6.requestId}::uuid)
      `;
      assert.equal(r6[0].state, 'REQUESTED');
      assert.equal(r6[0].idp_status, 'FAILED');
      assert.equal(r6[0].idp_last_error_code, 'IDP_PATH_404');

      await parkOpenRequests(boot.adminUrl, null);

      const u7 = await seedUser(db, randomUUID());
      const d7 = await createAccountDeletionRequest(db, {
        userId: u7.userId,
        confirmation: true,
      });
      const p7 = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_RETRYABLE,
          retryable: true,
          idpStatus: 'DISABLED_PENDING_DELETE',
        })),
      );
      assert.equal(p7.applied, 1);
      assert.equal(p7.completed, 0);
      const r7 = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status
        FROM get_account_deletion_idp_row(${d7.requestId}::uuid)
      `;
      assert.equal(r7[0].state, 'REQUESTED');
      assert.equal(r7[0].idp_status, 'DISABLED_PENDING_DELETE');

      await parkOpenRequests(boot.adminUrl, null);

      const u8 = await seedUser(db, randomUUID());
      const d8 = await createAccountDeletionRequest(db, {
        userId: u8.userId,
        confirmation: true,
      });
      let calls = 0;
      const handler = async () => {
        calls += 1;
        if (calls === 1) {
          return {
            kind: 'FAILED',
            errorCode: IDP_ERROR_CODES.IDP_HTTP_503,
            retryable: true,
          };
        }
        return { kind: 'DELETED' };
      };
      const p8a = await processDueAccountAnonymizations(db, 50, opts(handler));
      assert.equal(p8a.completed, 0);
      assert.equal(p8a.applied, 1);
      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      await admin.query(
        `UPDATE account_deletion_requests SET idp_next_attempt_at = NULL WHERE id = $1`,
        [d8.requestId],
      );
      await admin.query(
        `UPDATE account_deletion_requests
         SET idp_next_attempt_at = clock_timestamp() + interval '7 days'
         WHERE state = 'REQUESTED' AND id <> $1`,
        [d8.requestId],
      );
      await admin.end();
      const p8b = await processDueAccountAnonymizations(db, 50, opts(handler));
      assert.equal(p8b.completed, 1);
      const r8 = await db.$queryRaw`
        SELECT out_state AS state FROM get_account_deletion_idp_row(${d8.requestId}::uuid)
      `;
      assert.equal(r8[0].state, 'COMPLETED');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'SEC-2 T9/T11/T12/T13: upsert deny; lease; no fuzzy; issuer allowlist',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const sub = randomUUID();
      assert.equal(isUuidSubject(sub), true);
      assert.equal(isUuidSubject('not-a-uuid'), false);
      assert.equal(isUuidSubject('user@email'), false);

      const user = await seedUser(db, sub);
      await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });

      // Open REQUESTED blocks upsert (T9)
      const users = createPrismaIdentityUserRepository(db, {
        env: tombstoneEnv(),
      });
      await assert.rejects(
        () =>
          users.upsertFromVerifiedIdentity({
            issuer: ISSUER,
            subject: sub,
            email: 'x@example.com',
            emailVerified: true,
          }),
        (e) =>
          e instanceof IdentityError &&
          e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      );

      // Finish first request so later cases have a clean due queue
      await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );

      // T13 issuer not allowlisted → IdP not called; no COMPLETED
      const evilIssuer = 'http://evil.example/realms/x';
      const badIssuerUser = await createPrismaIdentityUserRepository(db, {
        env: tombstoneEnv({ OIDC_ISSUER: evilIssuer }),
      }).upsertFromVerifiedIdentity({
        issuer: evilIssuer,
        subject: randomUUID(),
        email: 'evil@example.com',
        emailVerified: true,
      });
      await createAccountDeletionRequest(db, {
        userId: badIssuerUser.userId,
        confirmation: true,
      });
      let idpCalls = 0;
      await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => {
          idpCalls += 1;
          return { kind: 'DELETED' };
        }),
      );
      assert.equal(idpCalls, 0);
      const evilAdmin = new Client({ connectionString: boot.adminUrl });
      await evilAdmin.connect();
      const evilRow = await evilAdmin.query(
        `SELECT state, idp_last_error_code FROM account_deletion_requests
         WHERE user_id = $1`,
        [badIssuerUser.userId],
      );
      assert.equal(evilRow.rows[0].state, 'REQUESTED');
      assert.equal(
        evilRow.rows[0].idp_last_error_code,
        IDP_ERROR_CODES.IDP_ISSUER_NOT_ALLOWLISTED,
      );
      await evilAdmin.end();

      // T11: second worker after COMPLETED sees NOT_FOUND / no double panic
      await parkOpenRequests(boot.adminUrl, null);
      const sub2 = randomUUID();
      const u2 = await seedUser(db, sub2);
      const d2 = await createAccountDeletionRequest(db, {
        userId: u2.userId,
        confirmation: true,
      });
      let deletes = 0;
      const shared = async () => {
        deletes += 1;
        return deletes === 1 ? { kind: 'DELETED' } : { kind: 'NOT_FOUND' };
      };
      const a = await processDueAccountAnonymizations(db, 50, opts(shared));
      assert.equal(a.completed, 1);
      const b = await processDueAccountAnonymizations(db, 50, opts(shared));
      assert.equal(b.completed, 0);
      const r2 = await db.$queryRaw`
        SELECT out_state AS state FROM get_account_deletion_idp_row(${d2.requestId}::uuid)
      `;
      assert.equal(r2[0].state, 'COMPLETED');
      assert.ok(deletes >= 1);
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
  'SEC-2 missing IdP config: PG may apply but never COMPLETED',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const user = await seedUser(db, randomUUID());
      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const env = tombstoneEnv();
      const processed = await processDueAccountAnonymizations(db, 50, {
        env,
        leaseOwner: 'no-idp',
        keyring: readTombstoneKeyring(env),
        idp: null,
      });
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 0);
      const row = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status,
               out_idp_last_error_code AS idp_last_error_code,
               out_pg_applied_at IS NOT NULL AS pg_ok
        FROM get_account_deletion_idp_row(${del.requestId}::uuid)
      `;
      assert.equal(row[0].state, 'REQUESTED');
      assert.equal(row[0].pg_ok, true);
      assert.equal(row[0].idp_status, 'FAILED');
      assert.equal(row[0].idp_last_error_code, 'IDP_MISCONFIGURED');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'SEC-2 T16: OIDC rejects access token lifetime > 24h',
  { timeout: 60000 },
  async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
    const publicJwk = await jose.exportJWK(publicKey);
    publicJwk.kid = 't16';
    publicJwk.alg = 'RS256';
    const verifier = createOidcVerifier(
      {
        issuer: ISSUER,
        audience: 'ticket-api',
        jwksUrl: 'https://jwks.test.local/jwks.json',
      },
      { jwks: createLocalJwks(publicJwk) },
    );
    const now = Math.floor(Date.now() / 1000);
    const longLived = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 't16' })
      .setIssuer(ISSUER)
      .setAudience('ticket-api')
      .setSubject(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 25 * 60 * 60)
      .sign(privateKey);
    await assert.rejects(
      () => verifier.verifyBearerToken('Bearer ' + longLived),
      (e) =>
        e instanceof IdentityError &&
        e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
    );
  },
);

test(
  'SEC-2 T17: upsert allowed after tombstone purge',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const sub = randomUUID();
      const user = await seedUser(db, sub);
      await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      await admin.query(
        `UPDATE account_deletion_requests
         SET subject_tombstone_expires_at = clock_timestamp() - interval '1 minute'
         WHERE subject_tombstone_digest IS NOT NULL`,
      );
      await admin.end();
      const purged = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.ok(purged.purged >= 1);
      const users = createPrismaIdentityUserRepository(db, {
        env: tombstoneEnv(),
      });
      const again = await users.upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: sub,
        email: 'again@example.com',
        emailVerified: true,
      });
      assert.notEqual(again.userId, user.userId);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test('SEC-2 B1 keyring parse: invalid JSON / empty ring throw KEYRING_INVALID', () => {
  const { TombstoneKeyringError } = require('../dist');
  assert.throws(
    () =>
      readTombstoneKeyring({
        ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k1',
        ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: '{not-json',
      }),
    (e) => e instanceof TombstoneKeyringError && e.code === 'KEYRING_INVALID',
  );
  assert.throws(
    () =>
      readTombstoneKeyring({
        ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k1',
        ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: '[]',
      }),
    (e) => e instanceof TombstoneKeyringError && e.code === 'KEYRING_INVALID',
  );
  assert.throws(
    () =>
      readTombstoneKeyring({
        ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'missing',
        ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
          {
            keyId: 'k1',
            secretBase64: Buffer.alloc(32, 11).toString('base64'),
          },
        ]),
      }),
    (e) => e instanceof TombstoneKeyringError && e.code === 'KEY_UNKNOWN',
  );
});

test(
  'SEC-2 B1: completed → unset/invalid/old-key-missing keyring denies upsert; retained old key denies',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const sub = randomUUID();
      const user = await seedUser(db, sub);
      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const processed = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 1);
      const completed = await db.$queryRaw`
        SELECT out_state AS state, out_idp_status AS idp_status
        FROM get_account_deletion_idp_row(${del.requestId}::uuid)
      `;
      assert.equal(completed[0].state, 'COMPLETED');
      assert.equal(completed[0].idp_status, 'DELETED');

      const identity = {
        issuer: ISSUER,
        subject: sub,
        email: 'recreate@example.com',
        emailVerified: true,
      };
      const denyUnauth = (e) =>
        e instanceof IdentityError &&
        e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED;

      // Unset / placeholder keyring after COMPLETED (live digest) → deny
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: {
              OIDC_ISSUER: ISSUER,
              ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: '[]',
              ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: '',
            },
          }).upsertFromVerifiedIdentity(identity),
        denyUnauth,
      );

      // Invalid JSON keyring → deny (not empty-ring allow)
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: {
              OIDC_ISSUER: ISSUER,
              ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: '{broken',
              ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k1',
            },
          }).upsertFromVerifiedIdentity(identity),
        denyUnauth,
      );

      // Mint key absent from ring (only unrelated key) → deny, no silent skip
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: {
              OIDC_ISSUER: ISSUER,
              ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'k9',
              ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
                {
                  keyId: 'k9',
                  secretBase64: Buffer.alloc(32, 99).toString('base64'),
                },
              ]),
            },
          }).upsertFromVerifiedIdentity(identity),
        denyUnauth,
      );

      // Retained mint key still in ring → digest hit denies recreate
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: tombstoneEnv(),
          }).upsertFromVerifiedIdentity(identity),
        denyUnauth,
      );

      // Zero live tombstones + unset keyring may stay operational
      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      await admin.query(
        `UPDATE account_deletion_requests
         SET subject_tombstone_expires_at = clock_timestamp() - interval '1 minute',
             subject_tombstone_digest = NULL,
             subject_tombstone_key_id = NULL
         WHERE subject_tombstone_digest IS NOT NULL
            OR subject_tombstone_key_id IS NOT NULL`,
      );
      await admin.end();
      const freshSub = randomUUID();
      const allowed = await createPrismaIdentityUserRepository(db, {
        env: {
          OIDC_ISSUER: ISSUER,
          ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: '[]',
          ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: '',
        },
      }).upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: freshSub,
        email: 'fresh@example.com',
        emailVerified: true,
      });
      assert.ok(allowed.userId);
      assert.notEqual(allowed.userId, user.userId);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'SEC-D-01: provider fault >48h pre-terminal keeps digest; denylist blocks after terminal; purge at terminal+48h',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const sub = randomUUID();
      const user = await seedUser(db, sub);
      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });

      // PG scrub succeeds; IdP keeps failing (provider fault).
      const first = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_RETRYABLE,
          retryable: true,
        })),
      );
      assert.equal(first.applied, 1);
      assert.equal(first.completed, 0);

      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();

      // Simulate >48h of provider fault: the tentative expiry lapses.
      await admin.query(
        `UPDATE account_deletion_requests
         SET subject_tombstone_expires_at = clock_timestamp() - interval '1 minute'
         WHERE id = $1`,
        [del.requestId],
      );

      // Still REQUESTED → open-request guard blocks upsert after >48h.
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: tombstoneEnv(),
          }).upsertFromVerifiedIdentity({
            issuer: ISSUER,
            subject: sub,
            email: 'again@example.com',
            emailVerified: true,
          }),
        (e) =>
          e instanceof IdentityError &&
          e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      );

      // Hourly purge while still REQUESTED must NOT null the digest.
      const purgedEarly = await db.$queryRaw`
        SELECT purge_expired_account_deletion_tombstones() AS n
      `;
      assert.equal(
        Number(purgedEarly[0].n),
        0,
        'REQUESTED digest must survive purge',
      );
      const digestRow = await admin.query(
        `SELECT subject_tombstone_digest IS NOT NULL AS has_digest,
                subject_tombstone_key_id IS NOT NULL AS has_key
         FROM account_deletion_requests WHERE id = $1`,
        [del.requestId],
      );
      assert.equal(
        digestRow.rows[0].has_digest,
        true,
        'digest preserved during provider fault >48h',
      );
      assert.equal(digestRow.rows[0].has_key, true);

      // IdP recovers after >48h → terminal DELETED.
      await admin.query(
        `UPDATE account_deletion_requests
         SET idp_next_attempt_at = clock_timestamp() - interval '1 second'
         WHERE id = $1`,
        [del.requestId],
      );
      const second = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.equal(second.completed, 1);

      // After COMPLETED the open-request guard is gone; the tombstone digest
      // must still block recreate within idp_deleted_at + 48h.
      const dig = await admin.query(
        `SELECT subject_tombstone_digest AS d FROM account_deletion_requests
         WHERE id = $1`,
        [del.requestId],
      );
      assert.ok(dig.rows[0].d, 'digest must still be present after terminal');
      const blocks = await db.$queryRaw`
        SELECT account_deletion_tombstone_blocks(
          ${ISSUER}::text,
          ${dig.rows[0].d}::bytea
        ) AS b
      `;
      assert.equal(blocks[0].b, true, 'tombstone blocks in post-terminal window');
      await assert.rejects(
        () =>
          createPrismaIdentityUserRepository(db, {
            env: tombstoneEnv(),
          }).upsertFromVerifiedIdentity({
            issuer: ISSUER,
            subject: sub,
            email: 'again@example.com',
            emailVerified: true,
          }),
        (e) =>
          e instanceof IdentityError &&
          e.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
      );

      // 48h after terminal → digest purged → upsert allowed (new identity).
      await admin.query(
        `UPDATE account_deletion_requests
         SET subject_tombstone_expires_at = clock_timestamp() - interval '1 minute'
         WHERE id = $1`,
        [del.requestId],
      );
      const purgedLate = await db.$queryRaw`
        SELECT purge_expired_account_deletion_tombstones() AS n
      `;
      assert.equal(
        Number(purgedLate[0].n),
        1,
        'terminal expired digest is purged',
      );
      const again = await createPrismaIdentityUserRepository(db, {
        env: tombstoneEnv(),
      }).upsertFromVerifiedIdentity({
        issuer: ISSUER,
        subject: sub,
        email: 'again@example.com',
        emailVerified: true,
      });
      assert.notEqual(again.userId, user.userId);
      await admin.end();
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'SEC-D-05: finalize fenced — expired lease / wrong owner never completes',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const user = await seedUser(db, randomUUID());
      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const env = tombstoneEnv();
      await processDueAccountAnonymizations(db, 50, {
        env,
        leaseOwner: 'no-idp',
        keyring: readTombstoneKeyring(env),
        idp: null,
      });

      // No lease held → any owner fails.
      let r = await db.$queryRaw`
        SELECT finalize_account_deletion_idp(
          ${del.requestId}::uuid, 'ownerA'::text, 'DELETED'::text
        ) AS ok
      `;
      assert.equal(r[0].ok, false);

      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();

      // Expired lease (owner matches but past expiry) → no COMPLETED.
      await admin.query(
        `UPDATE account_deletion_requests
         SET idp_lease_owner = 'ownerA',
             idp_lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE id = $1`,
        [del.requestId],
      );
      r = await db.$queryRaw`
        SELECT finalize_account_deletion_idp(
          ${del.requestId}::uuid, 'ownerA'::text, 'DELETED'::text
        ) AS ok
      `;
      assert.equal(r[0].ok, false);

      // Live lease owned by ownerA, but ownerB tries → no COMPLETED.
      await admin.query(
        `UPDATE account_deletion_requests
         SET idp_lease_owner = 'ownerA',
             idp_lease_expires_at = clock_timestamp() + interval '60 seconds'
         WHERE id = $1`,
        [del.requestId],
      );
      r = await db.$queryRaw`
        SELECT finalize_account_deletion_idp(
          ${del.requestId}::uuid, 'ownerB'::text, 'DELETED'::text
        ) AS ok
      `;
      assert.equal(r[0].ok, false);
      let row = await db.$queryRaw`
        SELECT out_state AS state FROM get_account_deletion_idp_row(${del.requestId}::uuid)
      `;
      assert.equal(row[0].state, 'REQUESTED');

      // Correct owner + live lease → COMPLETED.
      r = await db.$queryRaw`
        SELECT finalize_account_deletion_idp(
          ${del.requestId}::uuid, 'ownerA'::text, 'DELETED'::text
        ) AS ok
      `;
      assert.equal(r[0].ok, true);
      row = await db.$queryRaw`
        SELECT out_state AS state FROM get_account_deletion_idp_row(${del.requestId}::uuid)
      `;
      assert.equal(row[0].state, 'COMPLETED');

      // Double-finalize is a no-op (no false re-completion).
      r = await db.$queryRaw`
        SELECT finalize_account_deletion_idp(
          ${del.requestId}::uuid, 'ownerA'::text, 'DELETED'::text
        ) AS ok
      `;
      assert.equal(r[0].ok, false);
      await admin.end();
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'POL-01: PG scrub hard-deletes every device registration (active + revoked)',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const user = await seedUser(db, randomUUID());

      const admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      // Active and already-revoked registrations for the same user.
      await admin.query(
        `INSERT INTO device_tokens (id, user_id, token, environment, created_at, updated_at)
         VALUES
           ($1::uuid, $2::uuid, 'device-token-active-0000001', 'sandbox', now(), now()),
           ($3::uuid, $2::uuid, 'device-token-revoked-000002', 'production', now(), now())`,
        [randomUUID(), user.userId, randomUUID()],
      );
      await admin.query(
        `UPDATE device_tokens SET revoked_at = now()
         WHERE user_id = $1 AND token = 'device-token-revoked-000002'`,
        [user.userId],
      );
      const before = await admin.query(
        `SELECT count(*)::int AS n FROM device_tokens WHERE user_id = $1`,
        [user.userId],
      );
      assert.equal(before.rows[0].n, 2);

      const del = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const processed = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 1);

      const after = await admin.query(
        `SELECT count(*)::int AS n FROM device_tokens WHERE user_id = $1`,
        [user.userId],
      );
      assert.equal(
        after.rows[0].n,
        0,
        'no device registration (active or revoked) may remain after scrub',
      );
      await admin.end();
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'POL-01: re-register same token on another account after hard-delete works',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const token = 'pol01-reregister-token-0000001';
      const userA = await seedUser(db, randomUUID());
      const userB = await seedUser(db, randomUUID());

      const regA = await registerDeviceToken(db, {
        userId: userA.userId,
        token,
        environment: 'sandbox',
      });
      assert.ok(regA.registrationId);

      // Erase user A → hard-delete removes the registration row entirely.
      const del = await createAccountDeletionRequest(db, {
        userId: userA.userId,
        confirmation: true,
      });
      const processed = await processDueAccountAnonymizations(
        db,
        50,
        opts(async () => ({ kind: 'DELETED' })),
      );
      assert.equal(processed.applied, 1);
      assert.equal(processed.completed, 1);
      assert.equal(
        (await listActiveDeviceTokensForUser(db, userA.userId)).length,
        0,
      );

      // Same physical token re-registered on a different account works.
      const regB = await registerDeviceToken(db, {
        userId: userB.userId,
        token,
        environment: 'production',
      });
      assert.ok(regB.registrationId);
      assert.notEqual(regB.registrationId, regA.registrationId);
      const activeB = await listActiveDeviceTokensForUser(db, userB.userId);
      assert.equal(activeB.length, 1);
      assert.equal(activeB[0].token, token);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);
