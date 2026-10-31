import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomId } from './random-id.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('randomId returns a UUID without throwing when crypto.randomUUID exists', () => {
  const id = randomId();
  assert.match(id, UUID_RE);
  assert.notEqual(randomId(), id);
});
