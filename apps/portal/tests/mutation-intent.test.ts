import assert from 'node:assert/strict';
import test from 'node:test';
import { MutationIntent, intentStorageKey, type IntentScope, type IntentStorage } from '../src/client/mutation-intent';
import type { PortalFetchResult } from '../src/client/portal-fetch';

const scope: IntentScope = { actorId: 'staff-a', tenantId: 'tenant-a', eventId: 'event-a', command: 'approve' };
const ok = (json: unknown = { status: 'APPROVED' }): PortalFetchResult => ({ status: 200, json, networkError: false, timedOut: false });
const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };

function memoryStorage(): IntentStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}

test('committed request with lost response replays the same key and payload without another business effect', async () => {
  const storage = memoryStorage();
  let keys = 0;
  const client = new MutationIntent(scope, storage, () => `key-${++keys}`);
  const committed = new Map<string, PortalFetchResult>();
  let effects = 0;
  const send = async (body: Record<string, unknown>) => {
    const key = String(body.idempotencyKey);
    if (!committed.has(key)) { effects++; committed.set(key, ok()); return lost; }
    return committed.get(key)!;
  };
  const first = await client.run({ requestId: 'r1' }, send);
  assert.equal(first.kind, 'response');
  assert.equal(client.status?.state, 'unknown');
  const retry = await client.run({ requestId: 'r1' }, send);
  assert.deepEqual(retry, { kind: 'response', response: ok(), key: 'key-1' });
  assert.equal(effects, 1);
  assert.equal(keys, 1);
  assert.equal(client.status, null);
});

test('double click shares one in-flight promise and sends once', async () => {
  const storage = memoryStorage();
  const client = new MutationIntent(scope, storage);
  let finish!: (value: PortalFetchResult) => void;
  let markSent!: () => void;
  const sent = new Promise<void>((resolve) => { markSent = resolve; });
  let calls = 0;
  const send = () => { calls++; markSent(); return new Promise<PortalFetchResult>((resolve) => { finish = resolve; }); };
  const one = client.run({ requestId: 'r1' }, send);
  const two = client.run({ requestId: 'r1' }, send);
  assert.equal(one, two);
  await sent;
  finish(ok());
  await Promise.all([one, two]);
  assert.equal(calls, 1);
});

test('changed payload, context switch and reload cannot silently reuse or replace unknown intent', async () => {
  const storage = memoryStorage();
  const client = new MutationIntent(scope, storage, () => 'key-a');
  await client.run({ requestId: 'r1', reason: 'first' }, async () => lost);
  let sends = 0;
  const send = async () => { sends++; return ok(); };
  assert.deepEqual(await client.run({ requestId: 'r1', reason: 'changed' }, send), { kind: 'blocked', reason: 'changed' });
  const other = new MutationIntent({ ...scope, tenantId: 'tenant-b' }, storage, () => 'key-b');
  const otherResult = await other.run({ requestId: 'r1' }, send);
  assert.equal(otherResult.kind, 'response');
  assert.equal(storage.getItem(intentStorageKey(scope)) !== null, true);
  const recovered = new MutationIntent(scope, storage, () => 'key-c');
  assert.equal(recovered.needsReconciliation, true);
  assert.deepEqual(await recovered.run({ requestId: 'r1', reason: 'first' }, send), { kind: 'blocked', reason: 'recovered' });
  assert.equal(sends, 1);
});

test('expired key and payload conflict stay blocked for reconciliation; explicit release starts new intent', async () => {
  for (const code of ['IDEMPOTENCY_EXPIRED', 'IDEMPOTENCY_CONFLICT']) {
    const storage = memoryStorage();
    let keys = 0;
    const client = new MutationIntent(scope, storage, () => `key-${++keys}`);
    const response: PortalFetchResult = { status: 409, json: { code }, networkError: false, timedOut: false };
    await client.run({ requestId: 'r1' }, async () => response);
    assert.equal(client.status?.state, 'conflict');
    assert.deepEqual(await client.run({ requestId: 'r1' }, async () => ok()), { kind: 'blocked', reason: 'conflict' });
    assert.equal(keys, 1);
    client.release(); // Called only after operator's explicit reconciliation/confirmation.
    const next = await client.run({ requestId: 'r2' }, async () => ok());
    assert.equal(next.kind, 'response');
    assert.equal(keys, 2);
  }
});

test('429 respects Retry-After without changing key; 202 remains pending until job reconciliation', async () => {
  const storage = memoryStorage();
  let now = 1000;
  let keys = 0;
  const client = new MutationIntent(scope, storage, () => `key-${++keys}`, () => now);
  const response: PortalFetchResult = { status: 429, json: { code: 'RATE_LIMITED' }, networkError: false, timedOut: false, retryAfterMs: 3000 };
  await client.run({ requestId: 'r1' }, async () => response);
  assert.deepEqual(await client.run({ requestId: 'r1' }, async () => ok()), { kind: 'blocked', reason: 'backoff' });
  now = 4000;
  const accepted = await client.run({ requestId: 'r1' }, async (body) => {
    assert.equal(body.idempotencyKey, 'key-1');
    return { status: 202, json: { jobId: 'j1', status: 'PENDING' }, networkError: false, timedOut: false };
  });
  assert.equal(accepted.kind, 'response');
  assert.equal(client.status?.state, 'accepted');
  assert.deepEqual(await client.run({ requestId: 'r1' }, async () => ok()), { kind: 'blocked', reason: 'accepted' });
  assert.equal(keys, 1);
});

test('an old or unreadable stored intent cannot silently become a fresh operation', async () => {
  const storage = memoryStorage();
  let now = 1000;
  const client = new MutationIntent(scope, storage, () => 'key-1', () => now);
  await client.run({ requestId: 'r1' }, async () => lost);
  now += 6 * 60_000;
  assert.deepEqual(await client.run({ requestId: 'r1' }, async () => ok()), { kind: 'blocked', reason: 'stale' });
  storage.setItem(intentStorageKey(scope), '{broken');
  const unreadable = new MutationIntent(scope, storage);
  assert.deepEqual(await unreadable.run({ requestId: 'r1' }, async () => ok()), { kind: 'blocked', reason: 'conflict' });
});
