'use strict';

/**
 * DB-17 (D): named role presets — arbitrary permission deny / escalation.
 * A non-Owner (Manager / CS / Supervisor / Scanner) lacks `members.manage`, so
 * creating or listing role presets must fail-closed with PERMISSION_DENIED;
 * the preset catalogue stays the only grantable permission surface (no invented
 * or escalated permission arrays). Isolated Docker Postgres; runtime role.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  bootstrapPlatformOperator,
  provisionTenant,
  acceptMembershipInvite,
  createMembershipInvite,
  createRolePreset,
  listRolePresets,
  getRolePreset,
  readPlatformSecurityConfig,
  AUTHZ_ERROR_CODES,
  PLATFORM_ERROR_CODES,
  ROLE_SCHEMA_VERSION,
  PERMISSION_CATALOG,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-db17-role-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db17_role_test',
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
        'db17_role_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready);
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db17_role_test',
  });
  for (let i = 0; i < 30; i++) {
    try {
      await admin.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query(
    'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(
    "CREATE ROLE db17_role_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO db17_role_login');
  await admin.query('GRANT ticket_platform_runtime TO db17_role_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://db17_role_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db17_role_test',
  };
}

test(
  'DB-17: non-Owner cannot create/list role presets; catalogue stays the only grantable surface',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 6);
      const users = createPrismaIdentityUserRepository(db);
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });
      const issuer = 'http://localhost/realms/ticket';

      const operator = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'op-db17',
        email: 'op-db17@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner-db17',
        email: 'owner-db17@example.com',
        emailVerified: true,
      });
      const manager = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'mgr-db17',
        email: 'mgr-db17@example.com',
        emailVerified: true,
      });
      const scanner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'scan-db17',
        email: 'scan-db17@example.com',
        emailVerified: true,
      });

      const slug = 'db17-' + randomBytes(2).toString('hex');
      const tenant = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-db17',
        body: {
          slug,
          name: 'DB17 Role Escalation',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-db17@example.com',
          limits: {
            maxEvents: 10,
            maxStaff: 20,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      await acceptMembershipInvite(db, {
        userId: owner.userId,
        email: 'owner-db17@example.com',
        emailVerified: true,
        token: tenant.rawInviteToken,
      });

      // Invite and accept Manager + Scanner so their memberships are ACTIVE.
      const invMgr = await createMembershipInvite(db, security, {
        tenantId: tenant.tenantId,
        actorUserId: owner.userId,
        email: 'mgr-db17@example.com',
        role: 'Manager',
        clientKey: 'inv-mgr-db17',
      });
      await acceptMembershipInvite(db, {
        userId: manager.userId,
        email: 'mgr-db17@example.com',
        emailVerified: true,
        token: invMgr.rawToken,
      });
      const invScan = await createMembershipInvite(db, security, {
        tenantId: tenant.tenantId,
        actorUserId: owner.userId,
        email: 'scan-db17@example.com',
        role: 'Scanner',
        clientKey: 'inv-scan-db17',
      });
      await acceptMembershipInvite(db, {
        userId: scanner.userId,
        email: 'scan-db17@example.com',
        emailVerified: true,
        token: invScan.rawToken,
      });

      assert.equal(ROLE_SCHEMA_VERSION, 2);

      // Positive control: Owner can create a named preset; permissions are a
      // subset of the catalogue and never exceed it (no escalation surface).
      const preset = await createRolePreset(db, {
        tenantId: tenant.tenantId,
        actorUserId: owner.userId,
        name: 'SupervisorLite',
        tenantPermissions: [],
        eventPermissions: ['gate.confirm', 'gate.undo'],
      });
      assert.equal(preset.schemaVersion, 2);
      for (const p of preset.eventPermissions) {
        assert.ok(PERMISSION_CATALOG.includes(p), `${p} must be in catalogue`);
      }
      assert.ok(!preset.eventPermissions.includes('ticket.revoke'));

      // Arbitrary permission array (invented, not in catalogue) still rejected
      // for Owner too — the allowlist is the only grantable surface.
      await assert.rejects(
        () =>
          createRolePreset(db, {
            tenantId: tenant.tenantId,
            actorUserId: owner.userId,
            name: 'Escalation',
            eventPermissions: ['event.delete'],
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );

      // Escalation deny: Manager lacks members.manage → create/list denied.
      await assert.rejects(
        () =>
          createRolePreset(db, {
            tenantId: tenant.tenantId,
            actorUserId: manager.userId,
            name: 'MgrEscalation',
            tenantPermissions: ['members.manage'],
          }),
        (e) => e.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );
      await assert.rejects(
        () =>
          listRolePresets(db, {
            tenantId: tenant.tenantId,
            actorUserId: manager.userId,
          }),
        (e) => e.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );

      // Scanner (least privilege) also denied.
      await assert.rejects(
        () =>
          createRolePreset(db, {
            tenantId: tenant.tenantId,
            actorUserId: scanner.userId,
            name: 'ScanEscalation',
            eventPermissions: ['gate.confirm'],
          }),
        (e) => e.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );

      // Cross-tenant preset still 404 (RLS + explicit load).
      const slugB = 'db17b-' + randomBytes(2).toString('hex');
      const ownerB = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner-db17b',
        email: 'owner-db17b@example.com',
        emailVerified: true,
      });
      const tenantB = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-db17b',
        body: {
          slug: slugB,
          name: 'DB17 B',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-db17b@example.com',
          limits: {
            maxEvents: 10,
            maxStaff: 20,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
        },
      });
      await acceptMembershipInvite(db, {
        userId: ownerB.userId,
        email: 'owner-db17b@example.com',
        emailVerified: true,
        token: tenantB.rawInviteToken,
      });
      await assert.rejects(
        () =>
          getRolePreset(db, {
            tenantId: tenantB.tenantId,
            actorUserId: ownerB.userId,
            presetId: preset.presetId,
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
