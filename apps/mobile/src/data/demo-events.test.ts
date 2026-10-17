import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  demoTenants,
  findDemoEvent,
  findDemoEventById,
  listDemoEvents,
} from './demo-events.ts';

test('demo directory partitions organizations and rejects cross-tenant event links', () => {
  const first = listDemoEvents(demoTenants[0]);
  assert.ok(first.length > 0);
  assert.ok(first.every((event) => event.tenantSlug === demoTenants[0]));
  assert.equal(findDemoEvent(demoTenants[1], first[0].slug), undefined);
  assert.equal(findDemoEvent(demoTenants[0], first[0].slug), first[0]);
  assert.deepEqual(listDemoEvents('unknown-tenant'), []);
});
test('fixture catalog resolves an event id used by installed-app links', () => {
  const event = findDemoEventById('demo-mfest');
  assert.equal(event?.slug, 'mfest');
  assert.match(event?.name ?? '', /demo/i);
  assert.equal(findDemoEventById('missing-event'), undefined);
});
test('all event fixtures visibly identify themselves as demo data', () => {
  for (const tenant of demoTenants) {
    for (const event of listDemoEvents(tenant)) {
      assert.match(event.name, /demo/i);
      assert.match(event.brand.organizationName, /demo/i);
    }
  }
});
