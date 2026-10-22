import assert from 'node:assert/strict';
import test from 'node:test';
import { isDemoCatalogTenant } from '../src/home-catalog/demo-tenant';

test('isDemoCatalogTenant flags demo slugs and explicit demo org labels', () => {
  assert.equal(isDemoCatalogTenant('mfest-demo', 'MFest'), true);
  assert.equal(isDemoCatalogTenant('acme', 'Acme Corp · Demo'), true);
  assert.equal(isDemoCatalogTenant('acme-live', 'Acme Live'), false);
});
