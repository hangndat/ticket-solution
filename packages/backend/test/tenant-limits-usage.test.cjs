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
  createPrismaIdentityUserRepository,
  withTenant,
  grantMembership,
  authorizeTenantLimitsRead,
  readTenantLimitsUsage,
} = require('../dist');

const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

async function fixtureDatabase() {
  const name = 'ticket-limits-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker('run', '-d', '--name', name, '--label', 'ticket.task=task_728b2a584aea',
    '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=limits_test',
    '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'limits_test');
        ready = true;
        break;
      } catch { await new Promise((resolve) => setTimeout(resolve, 400)); }
    }
    assert.ok(ready, 'Postgres must start');
    const port = docker('port', name, '5432/tcp').split(':').at(-1);
    const admin = new Client({ connectionString:
      `postgresql://postgres:${password}@127.0.0.1:${port}/limits_test` });
    await admin.connect();
    try {
      await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
      await admin.query('SET ROLE migration_owner');
      for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
      await admin.query('RESET ROLE');
      await admin.query(`CREATE ROLE limits_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
      await admin.query('GRANT ticket_runtime TO limits_login');
      await admin.query("ALTER ROLE limits_login SET TimeZone = 'Pacific/Auckland'");
    } finally { await admin.end(); }
    return { name, url: `postgresql://limits_login:${password}@127.0.0.1:${port}/limits_test` };
  } catch (error) {
    docker('rm', '-f', name);
    throw error;
  }
}

test('G-10 runtime role reads only authorized tenant counters and UTC day',
  { timeout: 180000 }, async () => {
    let boot;
    let db;
    try {
      boot = await fixtureDatabase();
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://localhost/realms/limits-test';
      const owner = await users.upsertFromVerifiedIdentity({ issuer, subject: 'owner', email: 'owner@example.test', emailVerified: true });
      const manager = await users.upsertFromVerifiedIdentity({ issuer, subject: 'manager', email: 'manager@example.test', emailVerified: true });
      const revoked = await users.upsertFromVerifiedIdentity({ issuer, subject: 'revoked', email: 'revoked@example.test', emailVerified: true });
      const foreignOwner = await users.upsertFromVerifiedIdentity({ issuer, subject: 'foreign', email: 'foreign@example.test', emailVerified: true });
      const a = randomUUID(), b = randomUUID(), empty = randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await withTenant(db, a, async (tx) => {
        await tx.tenant.create({ data: { id: a, slug: 'limits-a', name: 'A' } });
        await tx.$executeRaw`INSERT INTO tenant_limits (tenant_id, max_events, max_staff, email_per_day, import_rows_per_job)
          VALUES (${a}::uuid, 9, NULL, 50, NULL)`;
        await grantMembership(tx, { tenantId: a, userId: owner.userId, role: 'Owner', permissions: ['tenant.profile'] });
        await grantMembership(tx, { tenantId: a, userId: manager.userId, role: 'Manager', permissions: ['report.read'] });
        const gone = await grantMembership(tx, { tenantId: a, userId: revoked.userId, role: 'Owner', permissions: ['tenant.profile'] });
        await tx.$executeRaw`UPDATE memberships SET revoked_at = now() WHERE tenant_id = ${a}::uuid AND id = ${gone.membershipId}::uuid`;
        await tx.event.create({ data: { tenantId: a, id: randomUUID(), slug: 'one', name: 'One' } });
        await tx.$executeRaw`INSERT INTO membership_invites (tenant_id, id, email, role, token_hash, expires_at, created_by)
          VALUES (${a}::uuid, ${randomUUID()}::uuid, 'pending@example.test', 'CS', 'pending-a', now() + interval '1 day', ${owner.userId}::uuid),
                 (${a}::uuid, ${randomUUID()}::uuid, 'expired@example.test', 'CS', 'expired-a', now() - interval '1 day', ${owner.userId}::uuid)`;
        await tx.$executeRaw`INSERT INTO tenant_email_usage (tenant_id, usage_date, sent_count)
          VALUES (${a}::uuid, ${today}::date, 7), (${a}::uuid, ${yesterday}::date, 99)`;
      });
      await withTenant(db, b, async (tx) => {
        await tx.tenant.create({ data: { id: b, slug: 'limits-b', name: 'B' } });
        await tx.$executeRaw`INSERT INTO tenant_limits (tenant_id, max_events) VALUES (${b}::uuid, 100)`;
        await grantMembership(tx, { tenantId: b, userId: foreignOwner.userId, role: 'Owner', permissions: ['tenant.profile'] });
        await tx.event.create({ data: { tenantId: b, id: randomUUID(), slug: 'foreign', name: 'Foreign' } });
      });
      await withTenant(db, empty, async (tx) => {
        await tx.tenant.create({ data: { id: empty, slug: 'limits-empty', name: 'Empty' } });
        await tx.$executeRaw`INSERT INTO tenant_limits (tenant_id) VALUES (${empty}::uuid)`;
        await grantMembership(tx, { tenantId: empty, userId: owner.userId, role: 'Owner', permissions: ['tenant.profile'] });
      });
      const snapshot = await readTenantLimitsUsage(db, a, owner.userId);
      assert.deepEqual(snapshot.limits, { maxEvents: 9, maxStaff: null, emailPerDay: 50, importRowsPerJob: null });
      assert.deepEqual(snapshot.usage, { events: 1, staffActive: 2, staffPendingInvites: 1, emailToday: 7 });
      assert.equal(snapshot.emailUsageDate, today, 'UTC day despite non-UTC DB session');
      assert.equal(snapshot.asOf.slice(0, 10), today);
      assert.equal(new Date(snapshot.asOf).toISOString(), snapshot.asOf);
      assert.deepEqual(Object.keys(snapshot).sort(), ['asOf', 'emailUsageDate', 'limits', 'tenantId', 'usage']);
      assert.doesNotMatch(JSON.stringify(snapshot), /example\.test|SUSPENDED|pending-a/);
      const blank = await readTenantLimitsUsage(db, empty, owner.userId);
      assert.deepEqual(blank.usage, { events: 0, staffActive: 1, staffPendingInvites: 0, emailToday: 0 });
      assert.deepEqual(blank.limits, { maxEvents: null, maxStaff: null, emailPerDay: null, importRowsPerJob: null });
      await assert.rejects(() => readTenantLimitsUsage(db, a, manager.userId), (e) => e.code === 'PERMISSION_DENIED');
      await assert.rejects(() => readTenantLimitsUsage(db, a, revoked.userId), (e) => e.code === 'MEMBERSHIP_REVOKED');
      await assert.rejects(() => readTenantLimitsUsage(db, b, owner.userId), (e) => e.code === 'MEMBERSHIP_REQUIRED');
      await assert.rejects(() => authorizeTenantLimitsRead(db, randomUUID(), owner.userId), (e) => e.code === 'MEMBERSHIP_REQUIRED');
    } finally {
      if (db) await db.$disconnect();
      if (boot) docker('rm', '-f', boot.name);
    }
  });
