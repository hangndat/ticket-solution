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
  assert.deepEqual(fresh, { kind: 'ok', sessionId });
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
