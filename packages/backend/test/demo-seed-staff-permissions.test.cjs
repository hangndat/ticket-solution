'use strict';

/**
 * D9 staff fixture re-seed must repair stale Owner tenant/event permissions
 * (UAT P0: gate OK + admin_denied when memberships.permissions stayed []).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  seedD9DemoDataset,
  listMyTenants,
  listMyEvents,
  D9_DEMO,
  readCodeHmacEnvironment,
  withTenant,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const OIDC = 'http://127.0.0.1:8080/realms/ticket';
const MFEST_TENANT = D9_DEMO.tenants.mfest.id;
const MFEST_EVENT = D9_DEMO.events.mfest.id;

async function startIsolatedPostgres() {
  const name = 'ticket-d9-staff-perms-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=ticket_test',
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
        'ticket_test',
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/ticket_test',
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
    for (const file of migrationFiles()) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d9_staff_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d9_staff_login');
    await admin.query('GRANT ticket_platform_runtime TO d9_staff_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://d9_staff_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/ticket_test',
  };
}

test(
  'D9 re-seed repairs Owner membership with empty tenantPermissions',
  { timeout: 180000 },
  async () => {
    let container;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      container = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-staff-perms-test-pepper',
        CODE_HMAC_VERSION: '1',
      });

      const first = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      const staffUserId = first.staffUserIds[0];
      assert.ok(staffUserId);

      const auroraTenant = '26c16ee9-1472-440e-98f2-de50d23aa938';
      const auroraEvent = '5295ef1a-56bc-4c9e-971d-708ce9596ffa';

      await withTenant(db, MFEST_TENANT, async (tx) => {
        const membership = await tx.membership.findFirst({
          where: { tenantId: MFEST_TENANT, userId: staffUserId },
        });
        assert.ok(membership);
        await tx.membership.update({
          where: { id: membership.id },
          data: { role: 'Owner', permissions: [] },
        });
        const assignment = await tx.eventAssignment.findFirst({
          where: {
            tenantId: MFEST_TENANT,
            eventId: MFEST_EVENT,
            membershipId: membership.id,
          },
        });
        assert.ok(assignment);
        await tx.eventAssignment.update({
          where: { id: assignment.id },
          data: { permissions: ['gate.confirm'] },
        });
      });

      await withTenant(db, auroraTenant, async (tx) => {
        await tx.tenant.create({
          data: {
            id: auroraTenant,
            slug: 'aurora-ops-0515',
            name: 'Aurora Night Org',
            status: 'ACTIVE',
          },
        });
        await tx.event.create({
          data: {
            tenantId: auroraTenant,
            id: auroraEvent,
            slug: 'aurora-night-150643',
            name: 'Aurora Night UAT',
            status: 'PUBLISHED',
            contentStatus: 'PUBLISHED',
            businessStatus: 'ACTIVE',
            visibility: 'PUBLIC',
          },
        });
        const membership = await tx.membership.create({
          data: {
            id: randomUUID(),
            tenantId: auroraTenant,
            userId: staffUserId,
            role: 'Owner',
            permissions: [
              'tenant.profile',
              'members.manage',
              'event.create',
              'event.list',
            ],
            activatedAt: new Date(),
          },
        });
        await tx.eventAssignment.create({
          data: {
            id: randomUUID(),
            tenantId: auroraTenant,
            eventId: auroraEvent,
            membershipId: membership.id,
            permissions: ['gate.confirm'],
            activatedAt: new Date(),
          },
        });
      });

      const broken = await listMyTenants(db, staffUserId);
      const brokenMfest = broken.find((t) => t.slug === 'mfest-demo');
      assert.ok(brokenMfest);
      assert.equal(brokenMfest.tenantPermissions.length, 0);

      const second = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      assert.ok(second.membershipsGranted >= 1 || second.assignmentsGranted >= 1);

      const repaired = await listMyTenants(db, staffUserId);
      const mfest = repaired.find((t) => t.slug === 'mfest-demo');
      assert.ok(mfest);
      assert.ok(mfest.tenantPermissions.includes('event.list'));
      assert.ok(mfest.tenantPermissions.includes('members.manage'));

      const events = await listMyEvents(db, staffUserId);
      assert.equal(events.staffEligible, true);
      assert.ok(
        events.items.some(
          (e) =>
            e.eventId === MFEST_EVENT &&
            e.permissions.includes('gate.confirm') &&
            e.permissions.includes('event.publish') &&
            e.permissions.includes('report.read'),
        ),
      );
      assert.ok(
        events.items.some(
          (e) =>
            e.eventId === auroraEvent &&
            e.permissions.includes('report.read') &&
            e.permissions.includes('event.publish'),
        ),
      );
    } finally {
      await db?.$disconnect().catch(() => {});
      if (container) docker('rm', '-f', container);
    }
  },
);
