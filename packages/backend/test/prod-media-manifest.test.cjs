'use strict';

const path = require('node:path');
process.env.PROD_REPO_ROOT = path.join(__dirname, '../../..');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  tenantOrgLogoAsset,
  tenantReadyObjectKey,
  loadProdMediaManifest,
} = require('../dist');

test('tenantOrgLogoAsset prefers tenants[].logo over tenantBrand.logo', () => {
  const manifest = {
    tenants: [
      {
        slug: 'fixture-org',
        tenantId: '686f0001-0001-4000-8000-000000000099',
        logo: {
          role: 'tenant-logo',
          assetId: '686f0001-0008-4000-8000-000099010000',
          source: 'brand/prod/fixture/logo.png',
          contentType: 'image/png',
          extension: 'png',
        },
        tenantBrand: {
          logo: {
            role: 'tenant-logo',
            assetId: '686f0001-0008-4000-8000-000099020000',
            source: 'brand/prod/fixture/legacy.png',
            contentType: 'image/png',
            extension: 'png',
          },
        },
        events: [],
      },
    ],
  };
  const logo = tenantOrgLogoAsset(manifest, manifest.tenants[0].tenantId);
  assert.equal(logo?.assetId, '686f0001-0008-4000-8000-000099010000');
});

test('tenantOrgLogoAsset tolerates missing manifest logo', () => {
  const manifest = {
    tenants: [
      {
        slug: 'no-logo',
        tenantId: '686f0001-0001-4000-8000-000000000098',
        events: [],
      },
    ],
  };
  assert.equal(
    tenantOrgLogoAsset(manifest, manifest.tenants[0].tenantId),
    undefined,
  );
});

test('tenantReadyObjectKey is event-independent', () => {
  const key = tenantReadyObjectKey(
    '686f0001-0001-4000-8000-000000000004',
    '686f0001-0008-4000-8000-000004010000',
    'png',
  );
  assert.equal(
    key,
    'tenants/686f0001-0001-4000-8000-000000000004/assets/ready/686f0001-0008-4000-8000-000004010000.png',
  );
});

test('prod manifest includes Mekong tenant logo', () => {
  const manifest = loadProdMediaManifest();
  const mekong = manifest.tenants.find((t) => t.slug === 'mekong-makers');
  assert.ok(mekong);
  const logo = tenantOrgLogoAsset(manifest, mekong.tenantId);
  assert.ok(logo?.assetId);
  assert.equal(mekong.events.length, 0);
});
