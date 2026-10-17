import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchTenantBranding,
  fetchTenantBrandingById,
  fetchTenantBrandingBySlug,
} from './branding-api.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

const beBody = {
  tenantId: '22222222-2222-2222-2222-222222222222',
  slug: 'acme',
  displayName: 'Acme Org',
  primaryColor: '#245B47',
  secondaryColor: null,
  logoAssetId: null,
  version: 3,
};

test('fetchTenantBranding misconfigured without API base', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  const result = await fetchTenantBranding({ tenantSlug: 'acme' });
  assert.equal(result.status, 'misconfigured');
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBrandingById uses Bearer auth path', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async (url, init) => {
    assert.match(url, /\/v1\/tenants\/22222222-2222-2222-2222-222222222222\/branding$/);
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      'Bearer tok',
    );
    return new Response(JSON.stringify(beBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const result = await fetchTenantBrandingById(
    '22222222-2222-2222-2222-222222222222',
    'tok',
    undefined,
    fetchImpl,
  );
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.branding.primaryColor, '#245b47');
    assert.equal(result.branding.tenantSlug, 'acme');
    assert.equal(result.branding.organizationName, 'Acme Org');
    assert.equal(result.branding.brandVersion, 3);
  }
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBranding prefers auth tenantId when bearer present', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async (url) => {
    assert.match(url, /\/v1\/tenants\//);
    return new Response(JSON.stringify(beBody), { status: 200 });
  });
  const result = await fetchTenantBranding({
    tenantId: '22222222-2222-2222-2222-222222222222',
    tenantSlug: 'acme',
    bearer: 'tok',
    fetchImpl,
  });
  assert.equal(result.status, 'ok');
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBrandingBySlug public path', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async (url) => {
    assert.match(url, /\/v1\/public\/tenants\/acme\/branding$/);
    return new Response(
      JSON.stringify({
        tenantSlug: 'acme',
        organizationName: 'Acme Org',
        primaryColor: '#245B47',
        logoUrl: 'https://cdn.example/logo.png',
      }),
      { status: 200 },
    );
  });
  const result = await fetchTenantBrandingBySlug('acme', undefined, fetchImpl);
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.branding.logoUrl, 'https://cdn.example/logo.png');
  }
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBranding 404 is not-found', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async () => new Response('', { status: 404 }));
  const result = await fetchTenantBrandingBySlug(
    'missing',
    undefined,
    fetchImpl,
  );
  assert.equal(result.status, 'not-found');
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBrandingById 401 is unauthorized', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async () => new Response('', { status: 401 }));
  const result = await fetchTenantBrandingById(
    '22222222-2222-2222-2222-222222222222',
    'bad',
    undefined,
    fetchImpl,
  );
  assert.equal(result.status, 'unauthorized');
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});

test('fetchTenantBranding network error is unreachable', async () => {
  const prev = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  const fetchImpl = mockFetch(async () => {
    throw new TypeError('network down');
  });
  const result = await fetchTenantBrandingBySlug(
    'acme',
    undefined,
    fetchImpl,
  );
  assert.equal(result.status, 'unreachable');
  if (prev === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = prev;
});
