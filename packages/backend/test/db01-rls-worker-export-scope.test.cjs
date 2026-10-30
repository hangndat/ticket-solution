// DB-01 (tests/e2e/PLAN.md §6.1): worker/export scope must not leak tenant PII.
// ticket_platform_runtime is the role platform/export-style cross-tenant
// reads run as (see withPlatformRole in src/platform-context.ts; published
// catalog filtering itself is already proven by published-events.test.cjs
// for DB-12). This file proves the piece DB-01 needs and nothing proves yet:
// the role has zero grant on any tenant PII table, so no future query
// written against it — worker, export, or otherwise — can leak
// tickets/users/codes/memberships/audit_logs cross-tenant.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const { createDatabase, withTenant, withPlatformRole } = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-db01-worker-export-' + randomBytes(6).toString('hex');
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
    'POSTGRES_DB=db01_worker_export_test',
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
        'db01_worker_export_test',
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
      '/db01_worker_export_test',
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
    "CREATE ROLE db01_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  // Real deployments split these across ticket_app / ticket_platform_app
  // (see infra/deploy/init-db.sh); granting both to one login here only
  // widens what this test session *can* reach, so a denial still proves
  // the role itself has no grant, not an artifact of test setup.
  await admin.query('GRANT ticket_runtime TO db01_login');
  await admin.query('GRANT ticket_platform_runtime TO db01_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://db01_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db01_worker_export_test',
  };
}

test(
  'DB-01: ticket_platform_runtime (worker/export) has no grant on any PII table and is denied reading one',
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

      const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await withTenant(db, A, async (tx) => {
        await tx.tenant.create({ data: { id: A, slug: 'db01-a', name: 'DB01 A' } });
      });

      // Structural guard: ticket_platform_runtime has zero grants on any
      // tenant PII table. This holds regardless of which query a future
      // export/worker feature writes.
      const piiTables = [
        'tickets',
        'users',
        'redemption_codes',
        'memberships',
        'event_assignments',
        'ticket_credentials',
        'notifications',
        'audit_logs',
      ];
      const grants = await db.$queryRaw`
        SELECT table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = 'ticket_platform_runtime'
          AND table_name = ANY(${piiTables})
      `;
      assert.deepEqual(
        grants,
        [],
        'ticket_platform_runtime must have no privilege on any PII table: ' +
          JSON.stringify(grants),
      );

      // Functional confirmation of the grant guard above: a direct read
      // through that role is rejected by PostgreSQL, not just filtered.
      await assert.rejects(
        () => withPlatformRole(db, (tx) => tx.$queryRaw`SELECT * FROM tickets`),
        /permission denied for table tickets/i,
      );
      await assert.rejects(
        () => withPlatformRole(db, (tx) => tx.$queryRaw`SELECT * FROM users`),
        /permission denied for table users/i,
      );
    } finally {
      if (db) await db.$disconnect();
      if (started) docker('rm', '-f', '-v', name);
    }
  },
);
