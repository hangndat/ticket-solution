const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  createMembershipInvite,
  acceptMembershipInvite,
  createRolePreset,
  getRolePreset,
  listRolePresets,
  provisionTenant,
  readPlatformSecurityConfig,
  bootstrapPlatformOperator,
  PLATFORM_ERROR_CODES,
  ROLE_SCHEMA_VERSION,
  withTenant,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');

function migrationFiles() {
  return require('node:fs')
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => !name.startsWith('.') && name !== 'migration_lock.toml')
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name, 'migration.sql'));
}

async function startIsolatedPostgres() {
  const name = 'ticket-role-presets-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=role_presets_test',
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
        'role_presets_test',
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
      '/role_presets_test',
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
    "CREATE ROLE rp_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO rp_login');
  await admin.query('GRANT ticket_platform_runtime TO rp_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://rp_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/role_presets_test',
  };
}

test(
  'P2-ROLES-PRESET: cross-tenant 404, forged perms rejected, Scanner no export',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 3);
      const users = createPrismaIdentityUserRepository(db);
      const security = readPlatformSecurityConfig({ NODE_ENV: 'test' });

      const operator = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'op-rp-1',
        email: 'op-rp@example.com',
        emailVerified: true,
      });
      await bootstrapPlatformOperator(db, { userId: operator.userId });

      const ownerA = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-a',
        email: 'owner-a@example.com',
        emailVerified: true,
      });
      const ownerB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'owner-b',
        email: 'owner-b@example.com',
        emailVerified: true,
      });
      const scannerUser = await users.upsertFromVerifiedIdentity({
        issuer: 'http://localhost/realms/ticket',
        subject: 'scanner-1',
        email: 'scanner@example.com',
        emailVerified: true,
      });

      const slugA = 'rp-a-' + randomBytes(2).toString('hex');
      const tenantA = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-a',
        body: {
          slug: slugA,
          name: 'Role Preset A',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-a@example.com',
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
        userId: ownerA.userId,
        email: 'owner-a@example.com',
        emailVerified: true,
        token: tenantA.rawInviteToken,
      });

      const slugB = 'rp-b-' + randomBytes(2).toString('hex');
      const tenantB = await provisionTenant(db, security, {
        actorUserId: operator.userId,
        clientKey: 'prov-b',
        body: {
          slug: slugB,
          name: 'Role Preset B',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'owner-b@example.com',
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
        email: 'owner-b@example.com',
        emailVerified: true,
        token: tenantB.rawInviteToken,
      });

      assert.equal(ROLE_SCHEMA_VERSION, 2);

      // AC-D2: invent perm rejected
      await assert.rejects(
        () =>
          createRolePreset(db, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            name: 'Evil',
            tenantPermissions: [],
            eventPermissions: ['inventory.read'],
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );
      await assert.rejects(
        () =>
          createRolePreset(db, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            name: 'Evil2',
            eventPermissions: ['audit.read'],
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );

      // Scanner-like preset: gate.confirm only — no export.*
      const scannerPreset = await createRolePreset(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        name: 'GateOnly',
        tenantPermissions: [],
        eventPermissions: ['gate.confirm'],
      });
      assert.ok(!scannerPreset.eventPermissions.includes('export.create'));
      assert.ok(!scannerPreset.eventPermissions.includes('export.download'));
      assert.equal(scannerPreset.schemaVersion, 2);

      const listed = await listRolePresets(db, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
      });
      assert.ok(listed.some((p) => p.presetId === scannerPreset.presetId));

      // Cross-tenant preset → RESOURCE_NOT_FOUND (404)
      await assert.rejects(
        () =>
          getRolePreset(db, {
            tenantId: tenantB.tenantId,
            actorUserId: ownerB.userId,
            presetId: scannerPreset.presetId,
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      );
      await assert.rejects(
        () =>
          createMembershipInvite(db, security, {
            tenantId: tenantB.tenantId,
            actorUserId: ownerB.userId,
            email: 'x@example.com',
            role: { presetId: scannerPreset.presetId },
            clientKey: 'cross',
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      );

      // Forged client permission arrays on invite rejected
      await assert.rejects(
        () =>
          createMembershipInvite(db, security, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            email: 'forged@example.com',
            role: 'Scanner',
            clientKey: 'forged',
            forgedPermissions: ['export.download'],
          }),
        (e) => e.code === PLATFORM_ERROR_CODES.INVALID_INPUT,
      );

      // Invite + accept with preset — membership role = preset id; no export
      const inv = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'scanner@example.com',
        role: { presetId: scannerPreset.presetId },
        clientKey: 'inv-scanner-preset',
      });
      const accepted = await acceptMembershipInvite(db, {
        userId: scannerUser.userId,
        email: 'scanner@example.com',
        emailVerified: true,
        token: inv.rawToken,
      });
      assert.equal(accepted.tenantId, tenantA.tenantId);

      await withTenant(db, tenantA.tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT role, permissions
          FROM memberships
          WHERE tenant_id = ${tenantA.tenantId}::uuid
            AND user_id = ${scannerUser.userId}::uuid
        `;
        assert.equal(rows[0].role, scannerPreset.presetId);
        assert.deepEqual(rows[0].permissions ?? [], []);
        assert.ok(!(rows[0].permissions ?? []).includes('export.download'));
      });

      // Built-in roles still work (AC-D3)
      const invMgr = await createMembershipInvite(db, security, {
        tenantId: tenantA.tenantId,
        actorUserId: ownerA.userId,
        email: 'mgr-' + randomUUID().slice(0, 8) + '@example.com',
        role: 'Manager',
        clientKey: 'inv-mgr-builtin',
      });
      assert.ok(invMgr.inviteId);

      // Unknown preset id
      await assert.rejects(
        () =>
          createMembershipInvite(db, security, {
            tenantId: tenantA.tenantId,
            actorUserId: ownerA.userId,
            email: 'ghost@example.com',
            role: { presetId: randomUUID() },
            clientKey: 'ghost',
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
