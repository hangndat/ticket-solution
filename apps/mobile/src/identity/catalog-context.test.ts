import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appCatalogMisconfigReason,
  catalogPlatformContractGap,
  isAppCatalogConfigured,
} from './catalog-context.ts';

test('platform catalog is always configured (no tenant slug env)', () => {
  const prevSlug = process.env.EXPO_PUBLIC_TENANT_SLUG;
  const prevApi = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_TENANT_SLUG;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  assert.equal(appCatalogMisconfigReason(), 'ok');
  assert.equal(isAppCatalogConfigured(), true);
  assert.equal(catalogPlatformContractGap(), null);
  if (prevSlug === undefined) delete process.env.EXPO_PUBLIC_TENANT_SLUG;
  else process.env.EXPO_PUBLIC_TENANT_SLUG = prevSlug;
  if (prevApi === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prevApi;
});
