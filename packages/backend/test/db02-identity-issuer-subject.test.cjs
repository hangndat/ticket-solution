// DB-02 (tests/e2e/PLAN.md §6.1): identity is keyed by issuer+subject, never
// auto-linked by email, and an identity that merely owns a ticket gets no
// implicit staff permission. Complements membership.test.cjs (deny-by-default,
// revoke, event assignment), which does not cover identity keying.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  requireTenantPermission,
  AuthzError,
  AUTHZ_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-db02-identity-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_02b2223952fb',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db02_identity_test',
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
        'db02_identity_test',
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db02_identity_test',
    connectionTimeoutMillis: 1000,
    query_timeout: 1000,
  });
  let connected = false;
  let connectionError;
  for (let i = 0; i < 30; i++) {
    try {
      await admin.connect();
      await admin.query('SELECT 1');
      connected = true;
      break;
    } catch (error) {
      connectionError = error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(connected, 'task database TCP connection must become ready: ' + connectionError);
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
    "CREATE ROLE db02_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO db02_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://db02_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db02_identity_test',
  };
}

test(
  'DB-02: identity keyed by issuer+subject, no auto-link by email, owner has no implicit staff permission',
  { timeout: 180000 },
  async () => {
    let started = false;
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      started = true;
      db = createDatabase(boot.url, 1);
      const users = createPrismaIdentityUserRepository(db);

      const sharedEmail = 'shared@example.com';
      const issuerOld = 'http://127.0.0.1:8080/realms/ticket-old';
      const issuerNew = 'http://127.0.0.1:8080/realms/ticket';

      // Two different IdP issuers asserting the SAME email must never
      // collapse into one user row: identity is issuer+subject, not email.
      const fromOldIssuer = await users.upsertFromVerifiedIdentity({
        issuer: issuerOld,
        subject: 'subject-1',
        email: sharedEmail,
        emailVerified: true,
      });
      const fromNewIssuer = await users.upsertFromVerifiedIdentity({
        issuer: issuerNew,
        subject: 'subject-1',
        email: sharedEmail,
        emailVerified: true,
      });
      assert.notEqual(
        fromOldIssuer.userId,
        fromNewIssuer.userId,
        'same subject string under a different issuer must be a distinct identity',
      );
      assert.equal(await db.user.count(), 2);

      // Repeating the upsert for the same issuer+subject must update the
      // existing row in place, not create a third identity.
      const fromOldIssuerAgain = await users.upsertFromVerifiedIdentity({
        issuer: issuerOld,
        subject: 'subject-1',
        email: sharedEmail,
        emailVerified: false,
      });
      assert.equal(fromOldIssuerAgain.userId, fromOldIssuer.userId);
      assert.equal(await db.user.count(), 2);

      // Grant staff membership to the new-issuer identity only.
      const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await withTenant(db, A, async (tx) => {
        await tx.tenant.create({ data: { id: A, slug: 'db02-a', name: 'DB02 A' } });
      });

      // The old-issuer identity (same email, no membership of its own) must
      // not inherit any permission — ownership of the shared email string
      // grants nothing by itself.
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: fromOldIssuer.userId,
              permission: 'ticket.read',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      );

      // A plain attendee identity (ticket owner, never a staff member) also
      // has no implicit staff permission — owning a ticket is not a role.
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer: issuerNew,
        subject: 'attendee-owner',
        email: 'attendee-owner@example.com',
        emailVerified: true,
      });
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: attendee.userId,
              permission: 'ticket.read',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      );

      // Users table is global/un-tenanted: RLS must not hide identities, but
      // it also must not let tenant context forge a cross-identity merge.
      const rows = await db.$queryRaw`
        SELECT issuer, subject, email FROM users WHERE email = ${sharedEmail} ORDER BY issuer
      `;
      assert.equal(rows.length, 2);
      assert.deepEqual(new Set(rows.map((r) => r.issuer)), new Set([issuerOld, issuerNew]));
    } finally {
      if (db) await db.$disconnect();
      if (started) docker('rm', '-f', '-v', name);
    }
  },
);
