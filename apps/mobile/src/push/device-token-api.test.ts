import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteDeviceToken, postDeviceToken } from './device-token-api.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

test('postDeviceToken accepts 2xx and validates registration body', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const fetchImpl = mockFetch(async () =>
    new Response(
      JSON.stringify({
        registrationId: '11111111-1111-1111-1111-111111111111',
        environment: 'sandbox',
        registeredAt: '2026-10-17T01:00:00.000Z',
      }),
      { status: 201 },
    ),
  );
  const result = await postDeviceToken(
    'bearer',
    { token: 'a'.repeat(32), environment: 'sandbox' },
    undefined,
    fetchImpl,
  );
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(
      result.registration.registrationId,
      '11111111-1111-1111-1111-111111111111',
    );
  }
});

test('postDeviceToken maps 401 and malformed body', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const unauthorized = await postDeviceToken(
    'bearer',
    { token: 'a'.repeat(32), environment: 'sandbox' },
    undefined,
    mockFetch(async () => new Response('', { status: 401 })),
  );
  assert.equal(unauthorized.status, 'unauthorized');

  const invalid = await postDeviceToken(
    'bearer',
    { token: 'a'.repeat(32), environment: 'sandbox' },
    undefined,
    mockFetch(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ),
  );
  assert.equal(invalid.status, 'invalid');
});

test('deleteDeviceToken treats 204 as ok and 404 as not-found', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const ok = await deleteDeviceToken(
    'bearer',
    '11111111-1111-1111-1111-111111111111',
    undefined,
    mockFetch(async () => new Response(null, { status: 204 })),
  );
  assert.equal(ok.status, 'ok');

  const missing = await deleteDeviceToken(
    'bearer',
    '11111111-1111-1111-1111-111111111111',
    undefined,
    mockFetch(async () => new Response('', { status: 404 })),
  );
  assert.equal(missing.status, 'not-found');
});
