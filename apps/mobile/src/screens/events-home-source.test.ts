import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  eventsHomeListSource,
  mustFailClosedWithoutDemo,
} from './events-home-source.ts';

test('events home FlatList source is published or none — never demo', () => {
  assert.equal(eventsHomeListSource(0), 'none');
  assert.equal(eventsHomeListSource(2), 'published');
});

test('error and empty phases stay fail-closed (no demo substitution)', () => {
  assert.equal(mustFailClosedWithoutDemo('error'), true);
  assert.equal(mustFailClosedWithoutDemo('misconfigured'), true);
  assert.equal(mustFailClosedWithoutDemo('ready'), true);
  assert.equal(mustFailClosedWithoutDemo('loading'), false);
});
