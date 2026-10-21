'use strict';

const path = require('node:path');
process.env.PROD_REPO_ROOT = path.join(__dirname, '../../..');

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
  getPublicTenantBranding,
  publishedTenantAssetPublicUrl,
  tenantReadyObjectKey,
  tenantOrgLogoAsset,
  loadProdMediaManifest,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

async function startIsolatedPostgres() {
  const name = 'ticket-pub-brand-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=pub_branding_test',
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
        'pub_branding_test',
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
      '/pub_branding_test',
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
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE pub_brand_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO pub_brand_login');
    await admin.query('GRANT ticket_platform_runtime TO pub_brand_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://pub_brand_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/pub_branding_test',
  };
}

test(
  'getPublicTenantBranding returns logoUrl when tenant_assets READY (Mekong)',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url);
      const manifest = loadProdMediaManifest();
      const mekong = manifest.tenants.find((t) => t.slug === 'mekong-makers');
      assert.ok(mekong);
      const orgLogo = tenantOrgLogoAsset(manifest, mekong.tenantId);
      assert.ok(orgLogo);

      const tenantId = mekong.tenantId;
      const userId = randomUUID();
      await db.user.create({
        data: {
          id: userId,
          email: 'owner@mekong.test',
          subject: 'sub-mekong',
          issuer: 'https://issuer.test',
        },
      });
      await db.tenant.create({
        data: {
          id: tenantId,
          slug: 'mekong-makers',
          name: 'Mekong Makers',
          status: 'ACTIVE',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          logoAssetId: orgLogo.assetId,
          displayName: 'Mekong Makers',
          primaryColor: '#2A6F97',
        },
      });

      const readyKey = tenantReadyObjectKey(
        tenantId,
        orgLogo.assetId,
        orgLogo.extension,
      );
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO tenant_assets (
            tenant_id, id, status, quarantine_key, ready_key,
            original_filename, content_type, byte_length, width_px, height_px,
            sha256, created_by, finalized_at
          ) VALUES (
            ${tenantId}::uuid,
            ${orgLogo.assetId}::uuid,
            'READY',
            ${'tenants/' + tenantId + '/assets/quarantine/' + orgLogo.assetId},
            ${readyKey},
            'logo.png',
            'image/png',
            1,
            760,
            200,
            'test',
            ${userId}::uuid,
            clock_timestamp()
          )
        `;
      });

      process.env.PUBLISHED_ASSET_PUBLIC_BASE = 'http://127.0.0.1:3100';
      const branding = await getPublicTenantBranding(db, 'mekong-makers');
      assert.ok(branding);
      assert.equal(branding.tenantSlug, 'mekong-makers');
      assert.equal(branding.logoAssetId, orgLogo.assetId);
      assert.equal(
        branding.logoUrl,
        publishedTenantAssetPublicUrl(
          'http://127.0.0.1:3100',
          'mekong-makers',
          orgLogo.assetId,
        ),
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);

test(
  'getPublicTenantBranding unknown slug → null',
  { timeout: 180000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url);
      const branding = await getPublicTenantBranding(db, 'not-a-real-tenant-slug');
      assert.equal(branding, null);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) docker('rm', '-f', name);
    }
  },
);
