import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchMeEvents, probeMeEvents } from './fetch-me-events.ts';

const sampleItem = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  eventId: '22222222-2222-2222-2222-222222222222',
  name: 'Demo Night',
  permissions: ['gate.confirm'],
};

test('fetchMeEvents returns null when API base or bearer missing', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  assert.equal(await fetchMeEvents('token'), null);
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  assert.equal(await fetchMeEvents(''), null);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});

test('fetchMeEvents accepts MeEventsResponse and rejects invalid bodies', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  let body: unknown = { staffEligible: true, items: [sampleItem] };
  let status = 200;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /\/v1\/me\/events$/);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await fetchMeEvents('tok'), {
      staffEligible: true,
      items: [sampleItem],
    });
    body = { staffEligible: false, items: [] };
    assert.deepEqual(await fetchMeEvents('tok'), {
      staffEligible: false,
      items: [],
    });
    body = { staffEligible: 'yes', items: [] };
    assert.equal(await fetchMeEvents('tok'), null);
    body = { staffEligible: true, items: [{ eventId: 'x' }] };
    assert.equal(await fetchMeEvents('tok'), null);
    body = { staffEligible: true, items: [sampleItem] };
    status = 401;
    assert.equal(await fetchMeEvents('tok'), null);
    assert.equal((await probeMeEvents('tok')).status, 'unauthorized');
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('probeMeEvents marks network failure unreachable (not unauthorized)', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Network request failed');
  };
  try {
    assert.equal((await probeMeEvents('tok')).status, 'unreachable');
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});
