import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SessionBoundary,
  type CredentialStore,
} from '../identity/session-boundary.ts';
import {
  assertsNoDeletedClaim,
  describeAccountDeletionRequest,
  accountDeletionExplainer,
} from './account-deletion-copy.ts';
import {
  clearAllPendingIdempotencyKeys,
  loadCurrentAccountDeletionRequest,
  mapPostResult,
  peekPendingIdempotencyKey,
  resolveIdempotencyKeyForSubmit,
  submitAccountDeletionRequest,
} from './account-deletion-flow.ts';

function credentialStore(initial: string | null = 'tok'): CredentialStore {
  let credential = initial;
  return {
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  };
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

const awaiting = {
  requestId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  state: 'AWAITING_POLICY' as const,
  requestedAt: '2026-10-17T03:00:00.000Z',
  policyStatus: 'UNRESOLVED' as const,
};

test('copy never claims deleted and ACK description avoids deleted label', () => {
  const explainer = accountDeletionExplainer();
  assert.equal(assertsNoDeletedClaim(explainer.body), true);
  assert.match(explainer.body, /O06/);
  assert.match(explainer.body, /không đủ|App Store/i);

  const described = describeAccountDeletionRequest(awaiting);
  assert.equal(assertsNoDeletedClaim(described.title), true);
  assert.equal(assertsNoDeletedClaim(described.body), true);
  assert.match(described.body, /ACK ≠|erasure|Chưa phải/i);
  assert.equal(assertsNoDeletedClaim(described.body), true);
});

test('timeout keeps same Idempotency-Key for retry; success clears pending', async () => {
  clearAllPendingIdempotencyKeys();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const boundary = new SessionBoundary(credentialStore());
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const epoch = boundary.captureEpoch();
  assert.ok(epoch);

  let calls = 0;
  const failing = mockFetch(async () => {
    calls += 1;
    throw new TypeError('offline');
  });

  const first = await submitAccountDeletionRequest({
    session: boundary,
    epoch: epoch!,
    userId: 'user-a',
    createId: () => 'fixed-key-aaaa-bbbb-cccc-ddddeeee0001',
    fetchImpl: failing,
  });
  assert.equal(first.kind, 'error');
  if (first.kind === 'error') {
    assert.equal(first.retryable, true);
    assert.equal(first.idempotencyKey, 'fixed-key-aaaa-bbbb-cccc-ddddeeee0001');
  }
  assert.equal(
    peekPendingIdempotencyKey('user-a'),
    'fixed-key-aaaa-bbbb-cccc-ddddeeee0001',
  );
  assert.equal(calls, 1);

  // Second submit without explicit key reuses retained key.
  const reused = resolveIdempotencyKeyForSubmit('user-a', () => 'should-not-run');
  assert.equal(reused, 'fixed-key-aaaa-bbbb-cccc-ddddeeee0001');

  let postedKey: string | null = null;
  const ok = await submitAccountDeletionRequest({
    session: boundary,
    epoch: epoch!,
    userId: 'user-a',
    idempotencyKey: peekPendingIdempotencyKey('user-a'),
    fetchImpl: mockFetch(async (_url, init) => {
      postedKey = new Headers(init?.headers).get('Idempotency-Key');
      return new Response(JSON.stringify(awaiting), { status: 202 });
    }),
  });
  assert.equal(postedKey, 'fixed-key-aaaa-bbbb-cccc-ddddeeee0001');
  assert.equal(ok.kind, 'acknowledged');
  if (ok.kind === 'acknowledged') {
    assert.equal(ok.ackMeansDeleted, false);
    assert.equal(ok.request.state, 'AWAITING_POLICY');
  }
  assert.equal(peekPendingIdempotencyKey('user-a'), undefined);
});

test('account switch cancels late POST so prior user status is not applied', async () => {
  clearAllPendingIdempotencyKeys();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore();
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const epochA = boundary.captureEpoch();
  assert.ok(epochA);

  let resolveFetch: ((value: Response) => void) | null = null;
  const pendingFetch = new Promise<Response>((resolve) => {
    resolveFetch = resolve;
  });

  const late = submitAccountDeletionRequest({
    session: boundary,
    epoch: epochA!,
    userId: 'user-a',
    createId: () => 'late-key',
    fetchImpl: mockFetch(async () => pendingFetch),
  });

  await boundary.establish('tok-b', async () => ({ userId: 'user-b' }));
  resolveFetch!(
    new Response(JSON.stringify(awaiting), { status: 202 }),
  );
  const phase = await late;
  // Generation bumped → idle / not acknowledged for user-a
  assert.equal(phase.kind, 'idle');
});

test('user A and B pending keys stay isolated', () => {
  clearAllPendingIdempotencyKeys();
  const a = resolveIdempotencyKeyForSubmit('user-a', () => 'key-a');
  const b = resolveIdempotencyKeyForSubmit('user-b', () => 'key-b');
  assert.equal(a, 'key-a');
  assert.equal(b, 'key-b');
  assert.equal(peekPendingIdempotencyKey('user-a'), 'key-a');
  assert.equal(peekPendingIdempotencyKey('user-b'), 'key-b');
});

test('mapPostResult never sets ackMeansDeleted true', () => {
  const phase = mapPostResult(
    { status: 'ok', request: awaiting, httpStatus: 202 },
    'k',
  );
  assert.equal(phase.kind, 'acknowledged');
  if (phase.kind === 'acknowledged') {
    assert.equal(phase.ackMeansDeleted, false);
  }
});

test('loadCurrent after switch drops stale epoch', async () => {
  clearAllPendingIdempotencyKeys();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const boundary = new SessionBoundary(credentialStore());
  await boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const epochA = boundary.captureEpoch();
  assert.ok(epochA);
  await boundary.establish('tok-b', async () => ({ userId: 'user-b' }));
  const phase = await loadCurrentAccountDeletionRequest({
    session: boundary,
    epoch: epochA!,
    fetchImpl: mockFetch(async () =>
      new Response(JSON.stringify(awaiting), { status: 200 }),
    ),
  });
  assert.equal(phase.kind, 'idle');
});
