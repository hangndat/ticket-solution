'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  readPortfolioReport,
  readEventReport,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

test(
  'DB-16: owner and manager portfolio respects assignment and tenant RLS',
  { timeout: 180000 },
  async () => {
    const name = `ticket-db16-${randomBytes(4).toString('hex')}`;
    const password = randomBytes(18).toString('hex');
    let db;
    try {
      docker(
        'run',
        '-d',
        '--name',
        name,
        '--label',
        'ticket.task=task_99b4f4571376',
        '-e',
        `POSTGRES_PASSWORD=${password}`,
        '-e',
        'POSTGRES_DB=db16',
        '-p',
        '127.0.0.1::5432',
        'postgres:18.1-alpine',
      );
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try {
          docker('exec', name, 'pg_isready', '-U', 'postgres', '-d', 'db16');
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      assert.ok(ready);
      const port = docker('port', name, '5432/tcp').split(':').at(-1);
      const admin = new Client({
        connectionString: `postgresql://postgres:${password}@127.0.0.1:${port}/db16`,
      });
      await admin.connect();
      try {
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
        for (const file of migrationFiles())
          await admin.query(readFileSync(file, 'utf8'));
        await admin.query('RESET ROLE');
        await admin.query(
          `CREATE ROLE db16_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`,
        );
        await admin.query('GRANT ticket_runtime TO db16_login');
      } finally {
        await admin.end();
      }
      db = createDatabase(
        `postgresql://db16_login:${password}@127.0.0.1:${port}/db16`,
        2,
      );
      const users = createPrismaIdentityUserRepository(db);
      const actors = {};
      for (const role of ['owner', 'manager', 'stranger']) {
        actors[role] = await users.upsertFromVerifiedIdentity({
          issuer: 'https://identity.example/realms/db16',
          subject: role,
          email: `${role}@example.com`,
          emailVerified: true,
        });
      }
      const tenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const ids = [
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '30000000-0000-4000-8000-000000000003',
      ];
      await withTenant(db, tenant, async (tx) => {
        await tx.tenant.create({
          data: { id: tenant, slug: 'db16', name: 'DB16' },
        });
        for (const [index, id] of ids.entries())
          await tx.event.create({
            data: {
              tenantId: tenant,
              id,
              slug: `event-${index}`,
              name: `Event ${index}`,
              status: 'DRAFT',
            },
          });
        for (const role of ['owner', 'manager']) {
          const member = await grantMembership(tx, {
            tenantId: tenant,
            userId: actors[role].userId,
            role: role.toUpperCase(),
            permissions: ['report.read'],
          });
          for (const eventId of [ids[0], ids[2]])
            await grantEventAssignment(tx, {
              tenantId: tenant,
              eventId,
              membershipId: member.membershipId,
              permissions: ['report.read'],
            });
        }
      });
      await withTenant(db, foreign, async (tx) => {
        await tx.tenant.create({
          data: { id: foreign, slug: 'db16-foreign', name: 'Foreign' },
        });
        await tx.event.create({
          data: {
            tenantId: foreign,
            id: '40000000-0000-4000-8000-000000000004',
            slug: 'foreign',
            name: 'Foreign secret',
            status: 'DRAFT',
          },
        });
      });
      const snapshot = () =>
        withTenant(
          db,
          tenant,
          (tx) =>
            tx.$queryRaw`SELECT (SELECT count(*)::int FROM events) AS events, (SELECT count(*)::int FROM memberships) AS memberships, (SELECT count(*)::int FROM event_assignments) AS assignments, (SELECT count(*)::int FROM audit_logs) AS audits`,
        );
      const initial = await snapshot();
      for (const role of ['owner', 'manager']) {
        const actorUserId = actors[role].userId;
        const read = (options = {}) =>
          withTenant(db, tenant, (tx) =>
            readPortfolioReport(tx, {
              tenantId: tenant,
              actorUserId,
              ...options,
            }),
          );
        const before = Date.now();
        const page1 = await read({ limit: 1 });
        const after = Date.now();
        assert.deepEqual(
          page1.items.map((item) => item.eventId),
          [ids[0]],
        );
        assert.ok(
          Date.parse(page1.asOf) >= before - 1000 &&
            Date.parse(page1.asOf) <= after + 1000,
        );
        assert.ok(page1.nextCursor);
        const page2 = await read({ limit: 1, cursor: page1.nextCursor });
        assert.deepEqual(
          page2.items.map((item) => item.eventId),
          [ids[2]],
        );
        assert.equal(page2.nextCursor, null);
        assert.equal((await read({ limit: 999 })).limit, 50);
        assert.equal((await read({ limit: 0 })).limit, 1);
        await assert.rejects(() => read({ cursor: 'invalid' }));
        await assert.rejects(() =>
          withTenant(db, tenant, (tx) =>
            readEventReport(tx, {
              tenantId: tenant,
              eventId: ids[1],
              actorUserId,
            }),
          ),
        );
        await assert.rejects(() =>
          withTenant(db, foreign, (tx) =>
            readPortfolioReport(tx, { tenantId: foreign, actorUserId }),
          ),
        );
      }
      await assert.rejects(() =>
        withTenant(db, tenant, (tx) =>
          readPortfolioReport(tx, {
            tenantId: tenant,
            actorUserId: actors.stranger.userId,
          }),
        ),
      );
      assert.deepEqual(
        await snapshot(),
        initial,
        'denied reads do not mutate tenant business state',
      );
      const tenantRows = await withTenant(
        db,
        tenant,
        (tx) => tx.$queryRaw`SELECT id FROM events ORDER BY id`,
      );
      assert.deepEqual(
        tenantRows.map((row) => row.id),
        ids,
      );
      const noContext = await db.$queryRaw`SELECT id FROM events`;
      assert.deepEqual(noContext, []);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      try {
        docker('rm', '-f', name);
      } catch {
        /* container may not have started */
      }
    }
  },
);
