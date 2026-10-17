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
  requireTenantPermission,
  grantMembership,
  grantEventAssignment,
  revokeMembership,
  AuthzError,
  AUTHZ_ERROR_CODES,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-d1-membership-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_f5dc73dc0239',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d1_membership_test',
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
        'd1_membership_test',
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
      '/d1_membership_test',
    connectionTimeoutMillis: 1000,
    query_timeout: 1000,
  };
  let admin;
  let connectionError;
  for (let i = 0; i < 30; i++) {
    const candidate = new Client(adminConfig);
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
  await admin.query(
    'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query(
    'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE d1_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO d1_login');
  await admin.end();
  const url =
    'postgresql://d1_login:' +
    password +
    '@127.0.0.1:' +
    port +
    '/d1_membership_test';
  return { name, password, port, url };
}

test(
  'membership deny-by-default, event permission, revoke, and lock conflict',
  { timeout: 180000 },
  async () => {
    let started = false;
    let name;
    let db;
    let db2;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      started = true;
      // Pool of 2 so FOR SHARE holder and FOR UPDATE revoker can run concurrently.
      db = createDatabase(boot.url, 2);
      db2 = createDatabase(boot.url, 1);

      const users = createPrismaIdentityUserRepository(db);
      const actor = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_membership_1',
        email: 'member@example.com',
        emailVerified: true,
      });
      const stranger = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_stranger',
        email: 'stranger@example.com',
        emailVerified: true,
      });

      const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
      const eventId = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';

      await withTenant(db, A, async (tx) => {
        await tx.tenant.create({
          data: { id: A, slug: 'tenant-a', name: 'Tenant A' },
        });
        await tx.event.create({
          data: {
            tenantId: A,
            id: eventId,
            slug: 'launch',
            name: 'Launch',
          },
        });
      });
      await withTenant(db, B, async (tx) => {
        await tx.tenant.create({
          data: { id: B, slug: 'tenant-b', name: 'Tenant B' },
        });
      });

      // Deny-by-default: no membership row.
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: actor.userId,
              permission: 'ticket.read',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      );

      // Inactive membership (never activated).
      await withTenant(db, A, async (tx) => {
        await grantMembership(tx, {
          tenantId: A,
          userId: stranger.userId,
          role: 'staff',
          permissions: ['ticket.read'],
          activatedAt: null,
        });
      });
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: stranger.userId,
              permission: 'ticket.read',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      );

      let membershipId;
      await withTenant(db, A, async (tx) => {
        const membership = await grantMembership(tx, {
          tenantId: A,
          userId: actor.userId,
          role: 'manager',
          permissions: ['ticket.read'],
        });
        membershipId = membership.membershipId;
      });

      // Permission present on membership → allow.
      await withTenant(db, A, async (tx) => {
        const allowed = await requireTenantPermission(tx, {
          tenantId: A,
          userId: actor.userId,
          permission: 'ticket.read',
        });
        assert.equal(allowed.membership.membershipId, membershipId);
      });

      // Missing tenant permission → deny.
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: actor.userId,
              permission: 'event.publish',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );

      // Event-scoped path: assignment required.
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: actor.userId,
              permission: 'gate.confirm',
              eventId,
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      );

      let assignmentId;
      await withTenant(db, A, async (tx) => {
        const assignment = await grantEventAssignment(tx, {
          tenantId: A,
          eventId,
          membershipId,
          permissions: ['gate.confirm'],
        });
        assignmentId = assignment.assignmentId;
        const allowed = await requireTenantPermission(tx, {
          tenantId: A,
          userId: actor.userId,
          permission: 'gate.confirm',
          eventId,
        });
        assert.equal(allowed.assignment.assignmentId, assignmentId);
      });

      // RLS: membership rows invisible without tenant context / other tenant.
      assert.equal(await db.membership.count(), 0);
      await withTenant(db, B, async (tx) => {
        assert.equal(await tx.membership.count(), 0);
        assert.equal(
          (
            await tx.membership.updateMany({
              where: { id: membershipId },
              data: { role: 'attack' },
            })
          ).count,
          0,
        );
      });

      // Privileged request succeeds before revoke commit.
      await withTenant(db, A, async (tx) => {
        await requireTenantPermission(tx, {
          tenantId: A,
          userId: actor.userId,
          permission: 'ticket.read',
        });
      });

      // §5.2: shared lock on active membership blocks concurrent FOR UPDATE revoke.
      let signalHoldReady;
      const holdReady = new Promise((resolve) => {
        signalHoldReady = resolve;
      });
      const holdPromise = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.tenant_id', ${A}, true)`;
          await tx.$queryRaw`SELECT set_config('statement_timeout', '15000', true)`;
          await requireTenantPermission(tx, {
            tenantId: A,
            userId: actor.userId,
            permission: 'ticket.read',
          });
          signalHoldReady();
          // Keep FOR SHARE until the revoker observes lock_timeout.
          await new Promise((r) => setTimeout(r, 2500));
        },
        { maxWait: 5000, timeout: 20000 },
      );
      await holdReady;

      await assert.rejects(
        () =>
          db2.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.tenant_id', ${A}, true)`;
              await tx.$queryRaw`SELECT set_config('lock_timeout', '500', true)`;
              await revokeMembership(tx, A, membershipId);
            },
            { maxWait: 5000, timeout: 10000 },
          ),
        (error) =>
          /lock_timeout|canceling statement due to lock timeout/i.test(
            String(error && error.message),
          ),
      );
      await holdPromise;

      // After revoke commits, subsequent privileged requests fail.
      await withTenant(db, A, async (tx) => {
        await revokeMembership(tx, A, membershipId);
      });
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: actor.userId,
              permission: 'ticket.read',
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REVOKED,
      );
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            requireTenantPermission(tx, {
              tenantId: A,
              userId: actor.userId,
              permission: 'gate.confirm',
              eventId,
            }),
          ),
        (error) =>
          error instanceof AuthzError &&
          error.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REVOKED,
      );

      // Cross-tenant insert of membership for tenant B under A context denied by RLS.
      await assert.rejects(
        withTenant(db, A, (tx) =>
          tx.membership.create({
            data: {
              id: randomUUID(),
              tenantId: B,
              userId: actor.userId,
              role: 'staff',
              permissions: ['ticket.read'],
              activatedAt: new Date(),
            },
          }),
        ),
      );
    } finally {
      if (db) await db.$disconnect();
      if (db2) await db2.$disconnect();
      if (started) docker('rm', '-f', '-v', name);
    }
  },
);
