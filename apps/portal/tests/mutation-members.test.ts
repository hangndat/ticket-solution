import assert from 'node:assert/strict';
import test from 'node:test';
import { MutationIntent, type IntentStorage } from '../src/client/mutation-intent';
import type { PortalFetchResult } from '../src/client/portal-fetch';
import { inviteDeliveryFailed, inviteQueued } from '../src/client/invite-outcome';

test('invite response separates created from provider delivery failure', () => {
  const base: PortalFetchResult = { status: 201, json: { inviteId: 'i1', state: 'PENDING', deliveryState: 'PENDING' }, networkError: false, timedOut: false };
  assert.equal(inviteQueued(base), true);
  const failed = { ...base, json: { inviteId: 'i1', state: 'PENDING', deliveryState: 'FAILED' } };
  assert.equal(inviteQueued(failed), false);
  assert.equal(inviteDeliveryFailed(failed), true);
  assert.equal(inviteQueued({ ...base, status: 202 }), false);
});

test('invite recovery stores no email and blocks changed recipient after reload', async () => {
  const values = new Map<string, string>();
  const storage: IntentStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
  const scope = { actorId: 'staff', tenantId: 'tenant', command: 'invite-member' };
  const intent = new MutationIntent(scope, storage, () => 'invite-key');
  const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };
  await intent.run({ email: 'person@example.test', role: 'Manager' }, async () => lost);
  assert.doesNotMatch([...values.values()].join(' '), /person@example|Manager/);
  const recovered = new MutationIntent(scope, storage);
  assert.equal(recovered.needsReconciliation, true);
  assert.deepEqual(await recovered.run({ email: 'other@example.test', role: 'Manager' }, async () => lost),
    { kind: 'blocked', reason: 'changed' });
  assert.deepEqual(await recovered.run({ email: 'person@example.test', role: 'Manager' }, async () => lost),
    { kind: 'blocked', reason: 'recovered' });
});
