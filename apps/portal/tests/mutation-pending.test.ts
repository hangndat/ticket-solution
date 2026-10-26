import assert from 'node:assert/strict';
import test from 'node:test';
import { MutationIntent, type IntentStorage } from '../src/client/mutation-intent';
import { decideAdmin } from '../src/ops/decide';
import type { PortalFetchResult } from '../src/client/portal-fetch';

test('unknown approval blocks a deny of the same request until reconciliation', async () => {
  const values = new Map<string, string>();
  const storage: IntentStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
  const intent = new MutationIntent({ actorId: 'staff', tenantId: 'tenant', eventId: 'event', command: 'pending-decision' }, storage);
  const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };
  await intent.run({ requestId: 'r1', decision: 'approve' }, async () => lost);
  let denyCalls = 0;
  assert.deepEqual(await intent.run({ requestId: 'r1', decision: 'deny', reason: 'No' }, async () => {
    denyCalls++; return lost;
  }), { kind: 'blocked', reason: 'changed' });
  assert.equal(denyCalls, 0);
  assert.equal(decideAdmin('approve', lost.status, lost.json, true).kind, 'unknown');
});
