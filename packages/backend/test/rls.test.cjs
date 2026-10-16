const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { createDatabase, withTenant } = require('../dist');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

test(
  'PostgreSQL RLS through Prisma: runtime role, cross-tenant, no context and reuse',
  { timeout: 180000 },
  async () => {
    const name = 'ticket-w0-backend-' + randomBytes(6).toString('hex');
    const password = randomBytes(24).toString('hex');
    let started = false,
      db,
      admin;
    try {
      docker(
        'run',
        '-d',
        '--name',
        name,
        '--label',
        'ticket.task=task_bb55492e627d',
        '-e',
        'POSTGRES_PASSWORD=' + password,
        '-e',
        'POSTGRES_DB=w0_backend_test',
        '-p',
        '127.0.0.1::5432',
        'postgres:18.1-alpine',
      );
      started = true;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          docker(
            'exec',
            name,
            'pg_isready',
            // The image's temporary bootstrap server only accepts Unix sockets.
            '-h',
            '127.0.0.1',
            '-U',
            'postgres',
            '-d',
            'w0_backend_test',
          );
          ready = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      assert.ok(ready, 'task database must become ready');
      const binding = docker('port', name, '5432/tcp');
      const port = binding.split(':').at(-1);
      const adminConfig = {
        connectionString:
          'postgresql://postgres:' +
          password +
          '@127.0.0.1:' +
          port +
          '/w0_backend_test',
        connectionTimeoutMillis: 1000,
        query_timeout: 1000,
      };
      let connectionError;
      for (let i = 0; i < 30; i++) {
        const candidate = new Client(adminConfig);
        // A startup disconnect can also emit an error outside the query promise.
        const onStartupError = (error) => {
          connectionError = error;
        };
        candidate.on('error', onStartupError);
        try {
          await candidate.connect();
          await candidate.query('SELECT 1');
          candidate.removeListener('error', onStartupError);
          admin = candidate;
          break;
        } catch (error) {
          connectionError = error;
          await candidate.end();
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      assert.ok(
        admin,
        'task database TCP connection must become ready: ' + connectionError,
      );
      // Privileged setup only. All isolation assertions below use a separate login.
      await admin.query(
        'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
      );
      await admin.query(
        'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
      );
      await admin.query(
        'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
      );
      await admin.query('SET ROLE migration_owner');
      await admin.query(
        readFileSync(
          'prisma/migrations/202610160001_foundation/migration.sql',
          'utf8',
        ),
      );
      await admin.query('RESET ROLE');
      await admin.query(
        "CREATE ROLE w0_login LOGIN PASSWORD '" +
          password +
          "' NOSUPERUSER NOBYPASSRLS INHERIT",
      );
      await admin.query('GRANT ticket_runtime TO w0_login');
      await admin.end();
      admin = undefined;
      db = createDatabase(
        'postgresql://w0_login:' +
          password +
          '@127.0.0.1:' +
          port +
          '/w0_backend_test',
        1,
      );
      const roles =
        await db.$queryRaw`SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      assert.equal(roles[0].name, 'w0_login');
      assert.equal(roles[0].rolsuper, false);
      assert.equal(roles[0].rolbypassrls, false);
      const tables =
        await db.$queryRaw`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.relname IN ('tenants', 'events') AND c.relnamespace = 'public'::regnamespace`;
      assert.equal(tables.length, 2);
      for (const table of tables) {
        assert.equal(table.owner, 'migration_owner');
        assert.equal(table.relrowsecurity, true);
        assert.equal(table.relforcerowsecurity, true);
      }
      const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
      const event = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
      for (const [tenantId, slug] of [
        [A, 'fixture-a'],
        [B, 'fixture-b'],
      ]) {
        await withTenant(db, tenantId, async (tx) => {
          await tx.tenant.create({ data: { id: tenantId, slug, name: slug } });
          await tx.event.create({
            data: { tenantId, id: event, slug: 'same-slug', name: slug },
          });
        });
      }
      await withTenant(db, A, async (tx) => {
        assert.deepEqual(
          (await tx.tenant.findMany()).map((t) => t.id),
          [A],
        );
        assert.deepEqual(
          (await tx.event.findMany()).map((e) => e.tenantId),
          [A],
        );
        assert.equal(await tx.event.count({ where: { tenantId: B } }), 0);
        assert.equal(
          (
            await tx.event.updateMany({
              where: { tenantId: B },
              data: { name: 'attack' },
            })
          ).count,
          0,
        );
        assert.equal(
          (await tx.event.deleteMany({ where: { tenantId: B } })).count,
          0,
        );
        assert.equal(
          (
            await tx.tenant.updateMany({
              where: { id: B },
              data: { name: 'attack' },
            })
          ).count,
          0,
        );
      });
      await assert.rejects(
        withTenant(db, A, (tx) =>
          tx.event.create({
            data: { tenantId: B, id: A, slug: 'attack', name: 'attack' },
          }),
        ),
      );
      await assert.rejects(
        withTenant(db, A, (tx) =>
          tx.tenant.create({ data: { id: B, slug: 'attack', name: 'attack' } }),
        ),
      );
      await assert.rejects(
        withTenant(db, A, (tx) =>
          tx.event.update({
            where: { tenantId_id: { tenantId: A, id: event } },
            data: { tenantId: B },
          }),
        ),
      );
      await assert.rejects(
        withTenant(db, A, (tx) =>
          tx.event.create({
            data: { tenantId: A, id: B, slug: 'same-slug', name: 'duplicate' },
          }),
        ),
      );
      // Raw SQL checks ensure invariants are enforced by PostgreSQL outside ORM.
      await assert.rejects(
        withTenant(
          db,
          A,
          (tx) =>
            tx.$executeRaw`INSERT INTO events (tenant_id, id, slug, name) VALUES (${A}::uuid, ${event}::uuid, 'new-slug', 'duplicate-id')`,
        ),
      );
      const C = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
      await assert.rejects(
        withTenant(
          db,
          C,
          (tx) =>
            tx.$executeRaw`INSERT INTO events (tenant_id, id, slug, name) VALUES (${C}::uuid, ${event}::uuid, 'orphan', 'orphan')`,
        ),
      );
      assert.equal(await db.event.count(), 0);
      assert.equal(await db.tenant.count(), 0);
      await assert.rejects(
        db.event.create({
          data: { tenantId: A, id: B, slug: 'absent', name: 'absent' },
        }),
      );
      const pids = new Set();
      for (const tenant of [A, B, A, B]) {
        await withTenant(db, tenant, async (tx) => {
          pids.add((await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid);
          assert.deepEqual(
            (await tx.event.findMany()).map((e) => e.tenantId),
            [tenant],
          );
        });
        assert.equal(await db.event.count(), 0);
      }
      assert.equal(pids.size, 1, 'single pool connection is actually reused');
      await assert.rejects(
        withTenant(db, A, async (tx) => {
          await tx.event.updateMany({ data: { name: 'rolled back' } });
          throw new Error('rollback fixture');
        }),
        /rollback fixture/,
      );
      assert.equal(await db.event.count(), 0);
      await withTenant(db, B, async (tx) =>
        assert.equal((await tx.event.findMany())[0].name, 'fixture-b'),
      );
      await withTenant(db, A, async (tx) =>
        assert.equal((await tx.event.findMany())[0].name, 'fixture-a'),
      );
    } finally {
      if (db) await db.$disconnect();
      if (admin) await admin.end();
      if (started) docker('rm', '-f', '-v', name);
    }
  },
);
