import assert from 'node:assert/strict';
import test from 'node:test';
import { createdEventDetailHref } from '../src/client/event-create-navigation';

test('createdEventDetailHref encodes tenant and event segments', () => {
  const tenantId = 'd9d9f001-0001-4000-8000-000000000001';
  const eventId = 'f6cd6c98-caaa-46aa-a957-3ba55dd81223';
  assert.equal(
    createdEventDetailHref(tenantId, eventId),
    `/t/${tenantId}/e/${eventId}`,
  );
});
