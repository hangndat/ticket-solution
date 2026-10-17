import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getCurrentAccountDeletionRequest,
  isAccountDeletionRequest,
  postAccountDeletionRequest,
} from './account-deletion-api.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

const sample = {
  requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  state: 'AWAITING_POLICY' as const,
  requestedAt: '2026-10-17T02:00:00.000Z',
  policyStatus: 'UNRESOLVED' as const,
};

test('isAccountDeletionRequest validates frozen shape', () => {
  assert.equal(isAccountDeletionRequest(sample), true);
  assert.equal(isAccountDeletionRequest({ ...sample, state: 'DONE' }), false);
  assert.equal(isAccountDeletionRequest(null), false);
});

test('postAccountDeletionRequest sends confirmation + Idempotency-Key and accepts 202', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  let seenKey: string | null = null;
  let seenBody: unknown = null;
  const result = await postAccountDeletionRequest(
    'bearer',
    '11111111-1111-1111-1111-111111111111',
    undefined,
    mockFetch(async (url, init) => {
      assert.match(url, /\/v1\/me\/account-deletion-requests$/);
      assert.equal(init?.method, 'POST');
      const headers = new Headers(init?.headers);
      seenKey = headers.get('Idempotency-Key');
      seenBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(sample), { status: 202 });
    }),
  );
  assert.equal(seenKey, '11111111-1111-1111-1111-111111111111');
  assert.deepEqual(seenBody, { confirmation: true });
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.request.state, 'AWAITING_POLICY');
    assert.equal(result.request.policyStatus, 'UNRESOLVED');
  }
});

test('post rejects COMPLETED ACK body (ACK ≠ deleted)', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const result = await postAccountDeletionRequest(
    'bearer',
    '11111111-1111-1111-1111-111111111111',
    undefined,
    mockFetch(async () =>
      new Response(
        JSON.stringify({ ...sample, state: 'COMPLETED' }),
        { status: 202 },
      ),
    ),
  );
  assert.equal(result.status, 'invalid');
});

test('post maps unreachable on network / 5xx for timeout recovery', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const down = await postAccountDeletionRequest(
    'bearer',
    'k',
    undefined,
    mockFetch(async () => {
      throw new TypeError('network');
    }),
  );
  assert.equal(down.status, 'unreachable');

  const five = await postAccountDeletionRequest(
    'bearer',
    'k',
    undefined,
    mockFetch(async () => new Response('', { status: 503 })),
  );
  assert.equal(five.status, 'unreachable');
});

test('getCurrent returns null or request object without wrapper', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const empty = await getCurrentAccountDeletionRequest(
    'bearer',
    undefined,
    mockFetch(async () => new Response('null', { status: 200 })),
  );
  assert.equal(empty.status, 'ok');
  if (empty.status === 'ok') assert.equal(empty.request, null);

  const present = await getCurrentAccountDeletionRequest(
    'bearer',
    undefined,
    mockFetch(async () => new Response(JSON.stringify(sample), { status: 200 })),
  );
  assert.equal(present.status, 'ok');
  if (present.status === 'ok') {
    assert.equal(present.request?.requestId, sample.requestId);
  }
});
