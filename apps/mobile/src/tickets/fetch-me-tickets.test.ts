import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchMeTickets, probeMeTickets } from './fetch-me-tickets.ts';

const sampleTicket = {
  ticketId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
  ticketTypeId: '44444444-4444-4444-4444-444444444444',
  sourceId: '55555555-5555-5555-5555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  createdAt: '2026-10-16T00:00:00.000Z',
};

test('fetchMeTickets returns null when API base or tenantId missing', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  assert.equal(await fetchMeTickets('token', 'tenant'), null);
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  assert.equal(await fetchMeTickets('token', ''), null);
  assert.equal(await fetchMeTickets('', 'tenant'), null);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});

test('fetchMeTickets accepts MeTicketsResponse and rejects invalid bodies', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  let body: unknown = { tickets: [sampleTicket] };
  let status = 200;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /\/v1\/me\/tickets\?tenantId=/);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await fetchMeTickets('tok', sampleTicket.tenantId), {
      tickets: [sampleTicket],
    });
    body = { tickets: [{ ticketId: 'x' }] };
    assert.equal(await fetchMeTickets('tok', sampleTicket.tenantId), null);
    body = { tickets: [sampleTicket] };
    status = 401;
    assert.equal(await fetchMeTickets('tok', sampleTicket.tenantId), null);
    assert.equal(
      (await probeMeTickets('tok', sampleTicket.tenantId)).status,
      'unauthorized',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('probeMeTickets owner aggregate omits tenantId query param', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.doesNotMatch(url, /tenantId=/);
    assert.match(url, /\/v1\/me\/tickets$/);
    return new Response(JSON.stringify({ tickets: [sampleTicket] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await probeMeTickets('tok', { kind: 'owner' });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.body.tickets.length, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('probeMeTickets marks network failure unreachable (not unauthorized)', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Network request failed');
  };
  try {
    assert.equal(
      (await probeMeTickets('tok', sampleTicket.tenantId)).status,
      'unreachable',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});
