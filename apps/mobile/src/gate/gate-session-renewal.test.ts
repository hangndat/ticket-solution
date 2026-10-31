import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openReplacementGateSession } from './gate-session-renewal.ts';

const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input = {
  bearer: 'test', apiBase: 'https://api.example',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
};

test('replacement uses real sessions endpoint and rejects stale before POST', async () => {
  let calls = 0;
  const outcome = await openReplacementGateSession({
    ...input, shouldContinue: () => false,
    fetchImpl: async () => { calls += 1; return new Response('', { status: 500 }); },
  });
  assert.equal(outcome.kind, 'stale');
  assert.equal(calls, 0);
});

test('replacement accepts server-issued UUID only while lifecycle is current', async () => {
  let allow = true;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const replacement = openReplacementGateSession({
    ...input, shouldContinue: () => allow,
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/v1\/gate\/events\/33333333-3333-4333-8333-333333333333\/sessions$/);
      assert.equal(JSON.parse(String(init?.body)).tenantId, input.tenantId);
      await waiting;
      return new Response(JSON.stringify({ sessionId }), { status: 201 });
    },
  });
  allow = false;
  release();
  assert.equal((await replacement).kind, 'stale');
  const fresh = await openReplacementGateSession({
    ...input, shouldContinue: () => true,
    fetchImpl: async () => new Response(JSON.stringify({ sessionId }), { status: 201 }),
  });
  assert.deepEqual(fresh, { kind: 'ok', sessionId, gateId: null, gateName: null });
});

for (const status of [401, 403] as const) {
  test(`replacement reports ${status} auth denial`, async () => {
    const result = await openReplacementGateSession({
      ...input, shouldContinue: () => true,
      fetchImpl: async () => new Response('', { status }),
    });
    assert.equal(result.kind, 'auth');
  });
}

test('replacement sends gateId only when chosen and returns gate fields', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const gateId = '22222222-2222-4222-8222-222222222222';
  const bodies: string[] = [];
  const fetchImpl = (async (_url: string, init?: { body?: string }) => {
    bodies.push(String(init?.body));
    return new Response(JSON.stringify({ sessionId, gateId, gateName: 'Cổng A' }), { status: 200 });
  }) as unknown as typeof fetch;
  const base = { bearer: 'b', apiBase: 'https://x.test', tenantId: '33333333-3333-4333-8333-333333333333', eventId: '44444444-4444-4444-8444-444444444444', shouldContinue: () => true, fetchImpl };
  const withGate = await openReplacementGateSession({ ...base, gateId });
  assert.deepEqual(withGate, { kind: 'ok', sessionId, gateId, gateName: 'Cổng A' });
  await openReplacementGateSession(base);
  assert.deepEqual(JSON.parse(bodies[0]!), { tenantId: base.tenantId, gateId });
  assert.deepEqual(JSON.parse(bodies[1]!), { tenantId: base.tenantId });
});
