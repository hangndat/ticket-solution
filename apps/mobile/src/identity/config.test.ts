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
  resolveApiBaseUrl,
  resolveOidcClientId,
  resolveOidcIssuer,
  showDemoEventCatalog,
  VEMOKI_PROD_API_BASE_URL,
} from './config.ts';
import { VEMOKI_PROD_PUBLIC } from './vemoki-public-constants.ts';

test('missing OIDC env is fail-closed only for local fixture bake', () => {
  assert.equal(
    resolveOidcIssuer({ allowLocalFixtureApi: true }, {}, {}),
    null,
  );
  assert.equal(
    resolveOidcClientId({ allowLocalFixtureApi: true }, {}, {}),
    null,
  );
});

test('retail bake pins prod OIDC when Metro env/extra are empty (TF fail-open Sign in)', () => {
  assert.equal(
    resolveOidcIssuer({ allowLocalFixtureApi: false }, {}, {}),
    VEMOKI_PROD_PUBLIC.oidcIssuer,
  );
  assert.equal(
    resolveOidcClientId({ allowLocalFixtureApi: false }, {}, {}),
    VEMOKI_PROD_PUBLIC.oidcClientId,
  );
});

test('blank OIDC env is fail-closed on local fixture bake', () => {
  assert.equal(
    resolveOidcIssuer(
      { allowLocalFixtureApi: true },
      { EXPO_PUBLIC_OIDC_ISSUER: '   ' },
      {},
    ),
    null,
  );
});

test('issuer + client id is configured on local fixture bake', () => {
  assert.equal(
    resolveOidcIssuer(
      { allowLocalFixtureApi: true },
      { EXPO_PUBLIC_OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket/' },
      {},
    ),
    'http://127.0.0.1:8080/realms/ticket',
  );
  assert.equal(
    resolveOidcClientId(
      { allowLocalFixtureApi: true },
      { EXPO_PUBLIC_OIDC_CLIENT_ID: 'ticket-mobile' },
      {},
    ),
    'ticket-mobile',
  );
});

test('retail getOidc* pins prod when env is unset', () => {
  const prevIssuer = process.env.EXPO_PUBLIC_OIDC_ISSUER;
  const prevClient = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  const prevUat = process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  const prevAps = process.env.EXPO_PUBLIC_APS_ENVIRONMENT;
  delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  process.env.EXPO_PUBLIC_APS_ENVIRONMENT = 'production';
  assert.equal(getOidcIssuer(), VEMOKI_PROD_PUBLIC.oidcIssuer);
  assert.equal(getOidcClientId(), VEMOKI_PROD_PUBLIC.oidcClientId);
  assert.equal(isOidcConfigured(), true);
  if (prevIssuer === undefined) delete process.env.EXPO_PUBLIC_OIDC_ISSUER;
  else process.env.EXPO_PUBLIC_OIDC_ISSUER = prevIssuer;
  if (prevClient === undefined) delete process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
  else process.env.EXPO_PUBLIC_OIDC_CLIENT_ID = prevClient;
  if (prevUat === undefined) delete process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  else process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = prevUat;
  if (prevAps === undefined) delete process.env.EXPO_PUBLIC_APS_ENVIRONMENT;
  else process.env.EXPO_PUBLIC_APS_ENVIRONMENT = prevAps;
});

test('API base URL is production unless baked allowLocalFixtureApi', () => {
  const env = { EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001/' };
  assert.equal(
    resolveApiBaseUrl({ allowLocalFixtureApi: false }, env, {}),
    VEMOKI_PROD_API_BASE_URL,
  );
  assert.equal(
    resolveApiBaseUrl({ allowLocalFixtureApi: true }, env, {}),
    'http://127.0.0.1:3001',
  );
  assert.equal(
    resolveApiBaseUrl({ allowLocalFixtureApi: true }, {}, {
      apiBaseUrl: 'http://127.0.0.1:3001',
    }),
    'http://127.0.0.1:3001',
  );
});

test('runtime getApiBaseUrl ignores UAT env when APS environment is production', () => {
  const prevApi = process.env.EXPO_PUBLIC_API_BASE_URL;
  const prevUat = process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  const prevAps = process.env.EXPO_PUBLIC_APS_ENVIRONMENT;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001/';
  process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = '1';
  process.env.EXPO_PUBLIC_APS_ENVIRONMENT = 'production';
  assert.equal(getApiBaseUrl(), VEMOKI_PROD_API_BASE_URL);
  if (prevApi === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prevApi;
  if (prevUat === undefined) delete process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  else process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = prevUat;
  if (prevAps === undefined) delete process.env.EXPO_PUBLIC_APS_ENVIRONMENT;
  else process.env.EXPO_PUBLIC_APS_ENVIRONMENT = prevAps;
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
