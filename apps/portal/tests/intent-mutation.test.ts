import assert from 'node:assert/strict';
import test from 'node:test';
import { IntentMutation, INTENT_RETRY_BACKOFF_MS, MAX_INTENT_RETRY_AGE_MS, intentBlockPresentation } from '../src/client/intent-mutation';
import { ActorBoundIntent } from '../src/client/actor-bound-intent';
import type { PortalFetchResult } from '../src/client/portal-fetch';

const scope = { actorId: 'actor-a', tenantId: 'tenant-a', eventId: 'event-a', command: 'event.clone' };
const ok = (eventId = 'clone-a'): PortalFetchResult => ({ status: 201, json: { eventId }, networkError: false, timedOut: false });
const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

test('server commit with lost response retries the exact key and payload', async () => {
  const storage = memoryStorage();
  const clock = { now: 1_000 };
  const intent = new IntentMutation(scope, storage, () => 'key-a', () => clock.now);
  const bodies: unknown[] = [];
  const send = async (body: { slug: string; idempotencyKey: string }) => {
    bodies.push(body);
    return bodies.length === 1 ? lost : ok();
  };
  const confirmed = (res: PortalFetchResult) => res.status === 201;
  assert.equal((await intent.run({ slug: 'clone' }, send, confirmed)).kind, 'unknown');
  clock.now += INTENT_RETRY_BACKOFF_MS;
  assert.equal((await intent.run({ slug: 'clone' }, send, confirmed)).kind, 'confirmed');
  assert.deepEqual(bodies, [
    { slug: 'clone', idempotencyKey: 'key-a' },
    { slug: 'clone', idempotencyKey: 'key-a' },
  ]);
  assert.equal(storage.values.size, 0);
});

test('retry uses serialized first payload even if caller mutates its object', async () => {
  const clock = { now: 1_000 };
  const intent = new IntentMutation(scope, memoryStorage(), () => 'key-a', () => clock.now);
  const payload = { slug: 'first' };
  await intent.run(payload, async () => lost, () => true);
  payload.slug = 'changed';
  clock.now += INTENT_RETRY_BACKOFF_MS;
  let calls = 0;
  const result = await intent.run({ slug: 'first' }, async (body) => {
    calls += 1;
    assert.deepEqual(body, { slug: 'first', idempotencyKey: 'key-a' });
    return ok();
  }, () => true);
  assert.equal(result.kind, 'confirmed');
  assert.equal(calls, 1);
});

test('double click shares one in-flight request', async () => {
  const intent = new IntentMutation(scope, memoryStorage(), () => 'key-a');
  let calls = 0;
  let resolve!: (result: PortalFetchResult) => void;
  const send = () => { calls += 1; return new Promise<PortalFetchResult>((done) => { resolve = done; }); };
  const first = intent.run({ slug: 'clone' }, send, () => true);
  const second = intent.run({ slug: 'clone' }, send, () => true);
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve(ok());
  assert.equal((await first).kind, 'confirmed');
});

test('context and actor changes cannot reuse an unresolved key', async () => {
  const storage = memoryStorage();
  const first = new IntentMutation(scope, storage, () => 'key-a');
  await first.run({ slug: 'clone' }, async () => lost, () => true);
  const otherEvent = new IntentMutation({ ...scope, eventId: 'event-b' }, storage, () => 'key-b');
  const otherActor = new IntentMutation({ ...scope, actorId: 'actor-b' }, storage, () => 'key-c');
  let observed = '';
  await otherEvent.run({ slug: 'clone' }, async (body) => { observed = body.idempotencyKey; return ok(); }, () => true);
  assert.equal(observed, 'key-b');
  await otherActor.run({ slug: 'clone' }, async (body) => { observed = body.idempotencyKey; return ok(); }, () => true);
  assert.equal(observed, 'key-c');
  assert.equal(first.state, 'unknown');
});

test('reload recovers unresolved marker but never blind-replays without payload', async () => {
  const storage = memoryStorage();
  const first = new IntentMutation(scope, storage, () => 'key-a');
  await first.run({ slug: 'clone' }, async () => lost, () => true);
  const restored = new IntentMutation(scope, storage, () => 'key-b');
  let calls = 0;
  const outcome = await restored.run({ slug: 'clone' }, async () => { calls += 1; return ok(); }, () => true);
  assert.deepEqual(outcome, { kind: 'blocked', reason: 'recovery' });
  assert.equal(calls, 0);
  assert.equal(storage.values.size, 1);
});

test('expiry, changed payload, and server hash conflict block rather than claim success', async () => {
  const clock = { now: 1_000 };
  const expiry = new IntentMutation(scope, memoryStorage(), () => 'key-a', () => clock.now);
  await expiry.run({ slug: 'clone' }, async () => lost, () => true);
  clock.now += MAX_INTENT_RETRY_AGE_MS;
  assert.deepEqual(await expiry.run({ slug: 'clone' }, async () => ok(), () => true), { kind: 'blocked', reason: 'expired' });

  const mismatch = new IntentMutation(scope, memoryStorage(), () => 'key-b');
  await mismatch.run({ slug: 'clone' }, async () => lost, () => true);
  assert.deepEqual(await mismatch.run({ slug: 'changed' }, async () => ok(), () => true), { kind: 'blocked', reason: 'mismatch' });

  const conflict = new IntentMutation(scope, memoryStorage(), () => 'key-c');
  const response: PortalFetchResult = { status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' }, networkError: false, timedOut: false };
  assert.deepEqual(await conflict.run({ slug: 'clone' }, async () => response, () => true), { kind: 'blocked', reason: 'conflict' });
  assert.equal(conflict.state, 'blocked');
});

test('FAILED response and malformed success do not produce confirmed outcome', async () => {
  const failed = new IntentMutation(scope, memoryStorage(), () => 'key-a');
  const response: PortalFetchResult = { status: 409, json: { code: 'FAILED' }, networkError: false, timedOut: false };
  assert.equal((await failed.run({ slug: 'clone' }, async () => response, () => true)).kind, 'rejected');
  const malformed = new IntentMutation(scope, memoryStorage(), () => 'key-b');
  const empty: PortalFetchResult = { status: 201, json: {}, networkError: false, timedOut: false };
  assert.equal((await malformed.run({ slug: 'clone' }, async () => empty, () => false)).kind, 'unknown');
});

test('auth rejection after unknown does not discard unresolved operation', async () => {
  const storage = memoryStorage();
  const clock = { now: 1_000 };
  const intent = new IntentMutation(scope, storage, () => 'key-a', () => clock.now);
  await intent.run({ slug: 'clone' }, async () => lost, () => true);
  clock.now += INTENT_RETRY_BACKOFF_MS;
  const unauthorized: PortalFetchResult = { status: 401, json: { code: 'UNAUTHENTICATED' }, networkError: false, timedOut: false };
  assert.deepEqual(await intent.run({ slug: 'clone' }, async () => unauthorized, () => true), { kind: 'blocked', reason: 'recovery' });
  assert.equal(storage.values.size, 1);
});

test('unknown outcome cannot be retried before the bounded deadline', async () => {
  const clock = { now: 1_000 };
  const intent = new IntentMutation(scope, memoryStorage(), () => 'key-a', () => clock.now);
  const keys: string[] = [];
  const send = async (body: { slug: string; idempotencyKey: string }) => {
    keys.push(body.idempotencyKey);
    return keys.length === 1 ? lost : ok();
  };
  assert.equal((await intent.run({ slug: 'clone' }, send, () => true)).kind, 'unknown');
  clock.now += INTENT_RETRY_BACKOFF_MS - 1;
  assert.equal((await intent.run({ slug: 'clone' }, send, () => true)).kind, 'unknown');
  assert.deepEqual(keys, ['key-a']);
  clock.now += 1;
  assert.equal((await intent.run({ slug: 'clone' }, send, () => true)).kind, 'confirmed');
  assert.deepEqual(keys, ['key-a', 'key-a']);
});

test('mounted controller invalidates A on actor switch before send and never reports A success', async () => {
  const storage = memoryStorage();
  let actor: string | null = 'actor-a';
  const bound = new ActorBoundIntent('actor-a', new IntentMutation(scope, storage, () => 'key-a'), async () => actor);
  let sends = 0;
  actor = 'actor-b';
  assert.deepEqual(await bound.run({ slug: 'clone' }, async () => { sends++; return ok(); }, () => true), { kind: 'blocked', reason: 'identity' });
  assert.equal(sends, 0);
  assert.equal(storage.values.size, 0);
  actor = 'actor-a';
  assert.equal((await bound.run({ slug: 'clone' }, async () => { sends++; return ok(); }, () => true)).kind, 'blocked');
  assert.equal(sends, 0);

  let resolve!: (result: PortalFetchResult) => void;
  const inFlight = new ActorBoundIntent('actor-a', new IntentMutation(scope, storage, () => 'key-b'), async () => actor);
  const result = inFlight.run({ slug: 'clone' }, async () => new Promise((done) => { resolve = done; }), () => true);
  await Promise.resolve();
  actor = 'actor-b';
  resolve(ok());
  assert.deepEqual(await result, { kind: 'blocked', reason: 'identity' });
});

test('actor switch preserves an unresolved A marker without sending its key as B', async () => {
  const storage = memoryStorage();
  let actor: string | null = 'actor-a';
  const bound = new ActorBoundIntent('actor-a', new IntentMutation(scope, storage, () => 'key-a'), async () => actor);
  assert.equal((await bound.run({ slug: 'clone' }, async () => lost, () => true)).kind, 'unknown');
  actor = 'actor-b';
  let sends = 0;
  assert.deepEqual(await bound.run({ slug: 'clone' }, async () => { sends++; return ok(); }, () => true), { kind: 'blocked', reason: 'identity' });
  assert.equal(sends, 0);
  assert.equal(storage.values.size, 1);
  const restoredA = new IntentMutation(scope, storage, () => 'key-new');
  assert.deepEqual(restoredA.blockReason, { kind: 'blocked', reason: 'recovery' });
});

test('identity unavailable and unresolved prior mutation have distinct recovery copy', () => {
  const identity = intentBlockPresentation('identity');
  const unresolved = intentBlockPresentation('recovery');
  assert.deepEqual(identity, { title: 'intent.identity.title', description: 'intent.identity', action: 'intent.identity.action', reload: true });
  assert.deepEqual(unresolved, { title: 'surface.unknown.title', description: 'intent.recovery', action: 'surface.action.recheck', reload: false });
});
