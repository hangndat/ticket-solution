import assert from 'node:assert/strict';
import test from 'node:test';
import { MutationIntent, type IntentStorage } from '../src/client/mutation-intent';
import type { PortalFetchResult } from '../src/client/portal-fetch';

function storage(): IntentStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
const scope = { actorId: 'staff', tenantId: 'tenant', eventId: 'event', command: 'update-event-metadata' };

test('event create keeps the key when 201 has no eventId and permits exact replay', async () => {
  const intent = new MutationIntent({ ...scope, eventId: undefined, command: 'create-event' }, storage(), () => 'event-key');
  const payload = { name: 'Festival', slug: 'festival', timezone: 'UTC', visibility: 'UNLISTED' };
  const definitive = (result: PortalFetchResult) => !!result.json && typeof result.json === 'object' &&
    typeof (result.json as { eventId?: unknown }).eventId === 'string';
  const incomplete: PortalFetchResult = { status: 201, json: {}, networkError: false, timedOut: false };
  await intent.run(payload, async () => incomplete, definitive);
  assert.equal(intent.status?.state, 'unknown');
  const retry = await intent.run(payload, async (body) => {
    assert.equal(body.idempotencyKey, 'event-key');
    return { ...incomplete, json: { eventId: 'event-1' } };
  }, definitive);
  assert.equal(retry.kind, 'response');
  assert.equal(intent.status, null);
});

test('setup metadata retry cannot send a changed revision/name with the old operation', async () => {
  const intent = new MutationIntent(scope, storage(), () => 'setup-key');
  const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };
  await intent.run({ expectedRevision: 4, name: 'Old' }, async () => lost);
  let calls = 0;
  const send = async () => { calls++; return { ...lost, status: 200, networkError: false, timedOut: false }; };
  assert.deepEqual(await intent.run({ expectedRevision: 5, name: 'New' }, send), { kind: 'blocked', reason: 'changed' });
  assert.equal(calls, 0);
});
