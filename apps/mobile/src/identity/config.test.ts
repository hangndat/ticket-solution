import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getApiBaseUrl,
  getApsEnvironment,
  getOidcClientId,
  getOidcIssuer,
  getTenantId,
  getTenantSlug,
  isOidcConfigured,
  showDemoEventCatalog,
  VEMOKI_PROD_API_BASE_URL,
} from './config.ts';

test('missing OIDC env is fail-closed (not configured)', () => {
  const prevIssuer = process.env.EXPO_PUBLIC_OIDC_ISSUER;
  const prevClient = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  assert.equal(getOidcIssuer(), null);
  assert.equal(getOidcClientId(), null);
  assert.equal(isOidcConfigured(), false);
  if (prevIssuer === undefined) delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  else process.env.EXPO_PUBLIC_OIDC_ISSUER = prevIssuer;
  if (prevClient === undefined) delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  else process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = prevClient;
});

test('blank OIDC env is fail-closed', () => {
  const prevIssuer = process.env.EXPO_PUBLIC_OIDC_ISSUER;
  const prevClient = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  process.env.EXPO_PUBLIC_OIDC_ISSUER = '   ';
  process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = 'ticket-mobile';
  assert.equal(getOidcIssuer(), null);
  assert.equal(isOidcConfigured(), false);
  if (prevIssuer === undefined) delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  else process.env.EXPO_PUBLIC_OIDC_ISSUER = prevIssuer;
  if (prevClient === undefined) delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  else process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = prevClient;
});

test('issuer + client id is configured', () => {
  const prevIssuer = process.env.EXPO_PUBLIC_OIDC_ISSUER;
  const prevClient = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  process.env.EXPO_PUBLIC_OIDC_ISSUER = 'http://127.0.0.1:8080/realms/ticket/';
  process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = 'ticket-mobile';
  assert.equal(getOidcIssuer(), 'http://127.0.0.1:8080/realms/ticket');
  assert.equal(getOidcClientId(), 'ticket-mobile');
  assert.equal(isOidcConfigured(), true);
  if (prevIssuer === undefined) delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  else process.env.EXPO_PUBLIC_OIDC_ISSUER = prevIssuer;
  if (prevClient === undefined) delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  else process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = prevClient;
});

test('API base URL is always production (K-API-02 / HOST-1)', () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001/';
  assert.equal(getApiBaseUrl(), VEMOKI_PROD_API_BASE_URL);
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  assert.equal(getApiBaseUrl(), 'https://api.vemoki.com');
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});

test('tenant id empty is null (no invented tenant)', () => {
  const previous = process.env.EXPO_PUBLIC_TENANT_ID;
  delete process.env.EXPO_PUBLIC_TENANT_ID;
  assert.equal(getTenantId(), null);
  process.env.EXPO_PUBLIC_TENANT_ID = '  ';
  assert.equal(getTenantId(), null);
  process.env.EXPO_PUBLIC_TENANT_ID = '22222222-2222-2222-2222-222222222222';
  assert.equal(getTenantId(), '22222222-2222-2222-2222-222222222222');
  if (previous === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
  else process.env.EXPO_PUBLIC_TENANT_ID = previous;
});

test('tenant slug empty is null (theme keeps Vemoki defaults)', () => {
  const previous = process.env.EXPO_PUBLIC_TENANT_SLUG;
  delete process.env.EXPO_PUBLIC_TENANT_SLUG;
  assert.equal(getTenantSlug(), null);
  process.env.EXPO_PUBLIC_TENANT_SLUG = '  ';
  assert.equal(getTenantSlug(), null);
  process.env.EXPO_PUBLIC_TENANT_SLUG = 'mfest-demo';
  assert.equal(getTenantSlug(), 'mfest-demo');
  if (previous === undefined) delete process.env.EXPO_PUBLIC_TENANT_SLUG;
  else process.env.EXPO_PUBLIC_TENANT_SLUG = previous;
});

test('production APS bake hides demo event catalog (no demo-mfest on TF home)', () => {
  const keys = [
    'EXPO_PUBLIC_APS_ENVIRONMENT',
    'APS_ENVIRONMENT',
    'APP_VARIANT',
  ] as const;
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  assert.equal(getApsEnvironment(), 'development');
  assert.equal(showDemoEventCatalog(), true);
  process.env.EXPO_PUBLIC_APS_ENVIRONMENT = 'production';
  assert.equal(getApsEnvironment(), 'production');
  assert.equal(showDemoEventCatalog(), false);
  for (const k of keys) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});
