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
  grantMembership,
  getTenantBranding,
  updateTenantBranding,
  AuthzError,
  AUTHZ_ERROR_CODES,
  BrandingError,
  BRANDING_ERROR_CODES,
  tenantPermissionsForRole,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

async function startIsolatedPostgres() {
  const name = 'ticket-d8-brand-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d8_branding_test',
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
        'd8_branding_test',
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d8_branding_test',
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
    for (const file of MIGRATIONS)
      await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d8_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d8_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://d8_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d8_branding_test',
  };
}

test(
  'tenant branding: migration columns, RLS isolation, get/update permission gate',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';

      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner-a',
        email: 'owner-a@example.com',
        emailVerified: true,
      });
      const scanner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'scanner-a',
        email: 'scanner-a@example.com',
        emailVerified: true,
      });
      const outsider = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'outsider',
        email: 'outsider@example.com',
        emailVerified: true,
      });

      const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

      await withTenant(db, A, async (tx) => {
        await tx.tenant.create({
          data: { id: A, slug: 'tenant-a', name: 'Tenant A Corp' },
        });
        await grantMembership(tx, {
          tenantId: A,
          userId: owner.userId,
          role: 'Owner',
          permissions: tenantPermissionsForRole('Owner'),
        });
        await grantMembership(tx, {
          tenantId: A,
          userId: scanner.userId,
          role: 'Scanner',
          permissions: tenantPermissionsForRole('Scanner'),
        });
      });
      await withTenant(db, B, async (tx) => {
        await tx.tenant.create({
          data: {
            id: B,
            slug: 'tenant-b',
            name: 'Tenant B Corp',
            displayName: 'Brand B',
            primaryColor: '#112233',
          },
        });
        await grantMembership(tx, {
          tenantId: B,
          userId: outsider.userId,
          role: 'Owner',
          permissions: tenantPermissionsForRole('Owner'),
        });
      });

      // Migration backfill: display_name seeded from name when unset.
      const defaults = await withTenant(db, A, (tx) =>
        getTenantBranding(tx, { tenantId: A, actorUserId: owner.userId }),
      );
      assert.equal(defaults.displayName, 'Tenant A Corp');
      assert.equal(defaults.primaryColor, '#0B3D2E');
      assert.equal(defaults.secondaryColor, null);
      assert.equal(defaults.version, 1);

      // Deny-by-default: no membership → MEMBERSHIP_REQUIRED
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            getTenantBranding(tx, {
              tenantId: A,
              actorUserId: outsider.userId,
            }),
          ),
        (e) =>
          e instanceof AuthzError &&
          e.code === AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      );

      // RLS: withTenant(A) cannot SELECT tenant B row
      await withTenant(db, A, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id FROM tenants WHERE id = ${B}::uuid
        `;
        assert.equal(rows.length, 0);
      });

      // Scanner can read (membership) but cannot update (no tenant.profile)
      const asScanner = await withTenant(db, A, (tx) =>
        getTenantBranding(tx, { tenantId: A, actorUserId: scanner.userId }),
      );
      assert.equal(asScanner.slug, 'tenant-a');

      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            updateTenantBranding(tx, {
              tenantId: A,
              actorUserId: scanner.userId,
              expectedVersion: 1,
              displayName: 'Hacked',
              primaryColor: '#FF0000',
            }),
          ),
        (e) =>
          e instanceof AuthzError &&
          e.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      );

      // Owner updates branding
      const logoId = randomUUID();
      const updated = await withTenant(db, A, (tx) =>
        updateTenantBranding(tx, {
          tenantId: A,
          actorUserId: owner.userId,
          expectedVersion: 1,
          displayName: 'Vemoki A',
          primaryColor: '#ABCDEF',
          secondaryColor: '#123',
          logoAssetId: logoId,
        }),
      );
      assert.equal(updated.displayName, 'Vemoki A');
      assert.equal(updated.primaryColor, '#ABCDEF');
      assert.equal(updated.secondaryColor, '#123');
      assert.equal(updated.logoAssetId, logoId);
      assert.equal(updated.version, 2);

      // Stale version rejected
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            updateTenantBranding(tx, {
              tenantId: A,
              actorUserId: owner.userId,
              expectedVersion: 1,
              displayName: 'Stale',
            }),
          ),
        (e) =>
          e instanceof BrandingError &&
          e.code === BRANDING_ERROR_CODES.STALE_VERSION,
      );

      // Invalid color rejected
      await assert.rejects(
        () =>
          withTenant(db, A, (tx) =>
            updateTenantBranding(tx, {
              tenantId: A,
              actorUserId: owner.userId,
              expectedVersion: 2,
              primaryColor: 'red',
            }),
          ),
        (e) =>
          e instanceof BrandingError &&
          e.code === BRANDING_ERROR_CODES.INVALID_INPUT,
      );

      // Wrong runtime types → BrandingError INVALID_INPUT (not TypeError / 500)
      for (const bad of [
        { displayName: 42 },
        { primaryColor: false },
        { secondaryColor: 3 },
        { logoAssetId: ['uuid'] },
      ]) {
        await assert.rejects(
          () =>
            withTenant(db, A, (tx) =>
              updateTenantBranding(tx, {
                tenantId: A,
                actorUserId: owner.userId,
                expectedVersion: 2,
                ...bad,
              }),
            ),
          (e) =>
            e instanceof BrandingError &&
            e.code === BRANDING_ERROR_CODES.INVALID_INPUT &&
            !(e instanceof TypeError),
        );
      }

      // Tenant B branding remains isolated
      const brandB = await withTenant(db, B, (tx) =>
        getTenantBranding(tx, { tenantId: B, actorUserId: outsider.userId }),
      );
      assert.equal(brandB.displayName, 'Brand B');
      assert.equal(brandB.primaryColor, '#112233');
      assert.equal(brandB.version, 1);
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
