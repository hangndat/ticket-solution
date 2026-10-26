import assert from 'node:assert/strict';
import test from 'node:test';
import { MutationIntent, type IntentStorage } from '../src/client/mutation-intent';
import type { PortalFetchResult } from '../src/client/portal-fetch';
import { eventFromMutation } from '../src/client/event-mutation-result';
import { collectEventWizardValues, type EventWizardValues } from '../src/client/event-wizard-values';

function storage(): IntentStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
const scope = { actorId: 'staff', tenantId: 'tenant', eventId: 'event', command: 'update-event-metadata' };

test('event wizard sends preserved fields from earlier unmounted steps', async () => {
  const preserved: EventWizardValues = {
    name: 'Festival', slug: 'festival', timezone: 'UTC', visibility: 'UNLISTED',
  };
  const values = await collectEventWizardValues({
    validateFields: async (names) => {
      assert.ok(names?.includes('name'));
      return {};
    },
    getFieldsValue: (all) => {
      assert.equal(all, true);
      return preserved;
    },
  });
  assert.deepEqual(values, preserved);
});

test('event create keeps the key when 201 has no eventId and permits exact replay', async () => {
  const intent = new MutationIntent({ ...scope, eventId: undefined, command: 'create-event' }, storage(), () => 'event-key');
  const payload = { name: 'Festival', slug: 'festival', timezone: 'UTC', visibility: 'UNLISTED' };
  const definitive = (result: PortalFetchResult) => eventFromMutation(result) !== null;
  const incomplete: PortalFetchResult = { status: 201, json: {}, networkError: false, timedOut: false };
  await intent.run(payload, async () => incomplete, definitive);
  assert.equal(intent.status?.state, 'unknown');
  const retry = await intent.run(payload, async (body) => {
    assert.equal(body.idempotencyKey, 'event-key');
    return { ...incomplete, json: { event: { eventId: 'event-1', revision: 1, contentStatus: 'DRAFT', name: 'Festival' } } };
  }, definitive);
  assert.equal(retry.kind, 'response');
  assert.equal(intent.status, null);
});

test('event mutation parses the nested event contract, including clone and archive', () => {
  const response: PortalFetchResult = { status: 201, json: { event: {
    eventId: 'clone-1', revision: 2, contentStatus: 'DRAFT', name: 'Clone',
  }, operationId: 'op-1' }, networkError: false, timedOut: false };
  assert.equal(eventFromMutation(response)?.eventId, 'clone-1');
  assert.equal(eventFromMutation({ ...response, json: { eventId: 'wrong-shape' } }), null);
  assert.equal(eventFromMutation({ ...response, json: { event: { ...((response.json as { event: object }).event), contentStatus: 'ARCHIVED' } } })?.contentStatus, 'ARCHIVED');
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
