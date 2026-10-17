const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { createDatabase, withTenant } = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const { migrationFiles } = require('./migration-files.cjs');

// users is global identity (policy USING true). outbox is ENABLE without FORCE
// so the migration-owned SECURITY DEFINER claim can see every tenant.
// device_tokens is actor-scoped (app.actor_id), not tenant-scoped.
// exports keeps FORCE RLS; migration_owner policy enables claim_exports_batch.
const GLOBAL_TABLES = new Set(['users']);
const ACTOR_TABLES = new Set(['device_tokens', 'account_deletion_requests']);
const UNFORCED_TABLES = new Set(['outbox']);
const DEFINER_OWNER_TABLES = new Set([
  'device_tokens',
  'exports',
  'tenant_limits',
  'membership_invites',
  'platform_operators',
  'platform_bootstrap_state',
  'platform_audit_logs',
  'tenants',
  'memberships',
  'support_grants',
  'events',
  'tickets',
  'users',
  'account_deletion_requests',
]);
/** Platform metadata pool — USING(true) cross-tenant (NOBYPASSRLS). */
const PLATFORM_OPEN_TABLES = new Set([
  'tenant_limits',
  'tenants',
  'platform_operators',
  'platform_bootstrap_state',
  'platform_audit_logs',
  'platform_operations',
  'membership_invites',
  'support_grants',
  'tenant_email_usage',
]);

async function startIsolatedPostgres() {
  const name = 'ticket-rls-cat-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=rls_catalog_test',
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
        'rls_catalog_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
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
      '/rls_catalog_test',
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
    for (const file of migrationFiles()) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE catalog_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO catalog_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://catalog_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/rls_catalog_test',
  };
}

test(
  'every tenant table is FORCE RLS and ticket_runtime has no BYPASSRLS',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 1);

      const roles = await db.$queryRaw`
        SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
        FROM pg_roles
        WHERE rolname IN ('ticket_runtime', 'ticket_platform_runtime', 'catalog_login')
        ORDER BY rolname
      `;
      assert.deepEqual(
        roles.map((role) => ({
          rolname: role.rolname,
          rolsuper: role.rolsuper,
          rolbypassrls: role.rolbypassrls,
          rolcanlogin: role.rolcanlogin,
        })),
        [
          {
            rolname: 'catalog_login',
            rolsuper: false,
            rolbypassrls: false,
            rolcanlogin: true,
          },
          {
            rolname: 'ticket_platform_runtime',
            rolsuper: false,
            rolbypassrls: false,
            rolcanlogin: false,
          },
          {
            rolname: 'ticket_runtime',
            rolsuper: false,
            rolbypassrls: false,
            rolcanlogin: false,
          },
        ],
      );
      // Ordinary roles may set row_security off; PostgreSQL then fails the query
      // instead of filtering. That is not a bypass, including on FORCE tables.
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL row_security = off');
        await assert.rejects(
          () => tx.$queryRaw`SELECT count(*)::int AS n FROM tenants`,
          /row-level security policy/i,
        );
      });

      const tables = await db.$queryRaw`
        SELECT c.relname,
               c.relrowsecurity,
               c.relforcerowsecurity,
               pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
      `;
      assert.ok(tables.length >= 20, 'migrations must create the tenant catalog');
      for (const table of tables) {
        assert.equal(table.owner, 'migration_owner', table.relname + ' owner');
        assert.equal(table.relrowsecurity, true, table.relname + ' ENABLE RLS');
        if (UNFORCED_TABLES.has(table.relname)) {
          assert.equal(
            table.relforcerowsecurity,
            false,
            table.relname + ' stays unforced for the definer claim',
          );
        } else {
          assert.equal(
            table.relforcerowsecurity,
            true,
            table.relname + ' FORCE RLS',
          );
        }
      }
      const names = new Set(tables.map((table) => table.relname));
      for (const required of [
        'tenants',
        'events',
        'users',
        'memberships',
        'event_assignments',
        'quota_buckets',
        'redemption_codes',
        'redemption_requests',
        'tickets',
        'ticket_credentials',
        'operations',
        'audit_logs',
        'staff_sessions',
        'checkin_reservations',
        'checkins',
        'offline_sync_events',
        'event_config_versions',
        'outbox',
        'notifications',
        'notification_attempts',
        'notification_templates',
        'notification_template_versions',
        'notification_rate_counters',
        'tenant_limits',
        'platform_operators',
        'platform_bootstrap_state',
        'platform_audit_logs',
        'platform_operations',
        'tenant_admin_operations',
        'membership_invites',
        'support_grants',
        'account_deletion_requests',
        'tenant_email_usage',
      ]) {
        assert.ok(names.has(required), 'missing table ' + required);
      }

      const policies = await db.$queryRaw`
        SELECT c.relname,
               pg_get_expr(p.polqual, p.polrelid) AS using_expr,
               pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
               pg_get_userbyid(p.polroles[1]) AS role_name
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `;
      const covered = new Set();
      for (const policy of policies) {
        covered.add(policy.relname);
        if (policy.role_name === 'migration_owner') {
          // Owner policy only for FORCE RLS + SECURITY DEFINER helpers.
          assert.ok(
            DEFINER_OWNER_TABLES.has(policy.relname),
            'unexpected owner policy on ' + policy.relname,
          );
          assert.equal(policy.using_expr, 'true');
          continue;
        }
        if (policy.role_name === 'ticket_platform_runtime') {
          assert.ok(
            PLATFORM_OPEN_TABLES.has(policy.relname),
            'unexpected platform policy on ' + policy.relname,
          );
          assert.equal(policy.using_expr, 'true');
          assert.equal(policy.check_expr, 'true');
          continue;
        }
        assert.equal(policy.role_name, 'ticket_runtime', policy.relname + ' policy role');
        if (GLOBAL_TABLES.has(policy.relname)) {
          assert.equal(policy.using_expr, 'true');
          assert.equal(policy.check_expr, 'true');
          continue;
        }
        if (ACTOR_TABLES.has(policy.relname)) {
          assert.match(policy.using_expr, /app\.actor_id/);
          assert.match(policy.check_expr, /app\.actor_id/);
          assert.notEqual(policy.using_expr, 'true', policy.relname + ' policy');
          continue;
        }
        assert.match(policy.using_expr, /app\.tenant_id/);
        assert.match(policy.check_expr, /app\.tenant_id/);
        assert.notEqual(policy.using_expr, 'true', policy.relname + ' policy');
      }
      for (const table of tables) {
        assert.ok(covered.has(table.relname), table.relname + ' has no policy');
      }

      const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const auditA = randomUUID();
      const auditB = randomUUID();
      for (const [tenantId, slug, auditId] of [
        [tenantA, 'catalog-a', auditA],
        [tenantB, 'catalog-b', auditB],
      ]) {
        await withTenant(db, tenantId, async (tx) => {
          await tx.tenant.create({ data: { id: tenantId, slug, name: slug } });
          await tx.$executeRaw`
            INSERT INTO audit_logs (tenant_id, id, action, resource_type)
            VALUES (${tenantId}::uuid, ${auditId}::uuid, 'rls.catalog', 'tenant')
          `;
        });
      }
      await withTenant(db, tenantA, async (tx) => {
        const rows = await tx.$queryRaw`SELECT id::text AS id FROM audit_logs ORDER BY id`;
        assert.deepEqual(
          rows.map((row) => row.id),
          [auditA],
        );
        assert.equal(
          (
            await tx.$executeRaw`
              UPDATE audit_logs SET reason = 'attack' WHERE tenant_id = ${tenantB}::uuid
            `
          ),
          0,
        );
      });
      const bare = await db.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`;
      assert.equal(bare[0].n, 0);
      await withTenant(db, tenantB, async (tx) => {
        const rows = await tx.$queryRaw`SELECT reason FROM audit_logs`;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].reason, null);
      });
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* container already gone */
        }
      }
    }
  },
);
