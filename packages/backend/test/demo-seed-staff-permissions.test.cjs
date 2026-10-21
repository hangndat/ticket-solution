'use strict';

/**
 * D9 staff fixture re-seed must repair stale Owner tenant/event permissions
 * (UAT P0: gate OK + admin_denied when memberships.permissions stayed []).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
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
    '0:5432',
    'postgres:16-alpine',
  );
  const port = docker('port', name, '5432/tcp').split(':').pop();
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/ticket_test`;
  const { migrationFiles } = require('./migration-files.cjs');
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const file of migrationFiles()) {
    const sql = require('node:fs').readFileSync(file, 'utf8');
    await client.query(sql);
  }
  await client.end();
  return { name, url };
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
            e.permissions.includes('event.publish'),
        ),
      );
    } finally {
      await db?.$disconnect().catch(() => {});
      if (container) docker('rm', '-f', container);
    }
  },
);
