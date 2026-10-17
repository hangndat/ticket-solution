import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearCachedBranding,
  createMemoryBrandingCacheStore,
  isLogoUrlFailed,
  markLogoUrlFailed,
  readCachedBranding,
  resetFailedLogoUrlsForTests,
  writeCachedBranding,
} from './branding-cache.ts';

test('branding cache round-trip and clear', async () => {
  const store = createMemoryBrandingCacheStore();
  const branding = {
    tenantSlug: 'acme',
    organizationName: 'Acme',
    primaryColor: '#245b47',
    logoUrl: 'https://cdn.example/logo.png',
    logoAssetId: null,
    secondaryColor: null,
  };
  await writeCachedBranding(branding, store, 'slug:acme');
  const read = await readCachedBranding('slug:acme', store);
  assert.deepEqual(read, branding);
  await clearCachedBranding('slug:acme', store);
  assert.equal(await readCachedBranding('slug:acme', store), null);
});

test('corrupt cache yields null (no throw)', async () => {
  const store = createMemoryBrandingCacheStore();
  await store.write('ticket.tenant-branding.v1:bad', '{not-json');
  assert.equal(await readCachedBranding('bad', store), null);
});

test('failed logo URLs are remembered for session', () => {
  resetFailedLogoUrlsForTests();
  assert.equal(isLogoUrlFailed(null), true);
  assert.equal(isLogoUrlFailed('https://cdn.example/x.png'), false);
  markLogoUrlFailed('https://cdn.example/x.png');
  assert.equal(isLogoUrlFailed('https://cdn.example/x.png'), true);
  resetFailedLogoUrlsForTests();
});
