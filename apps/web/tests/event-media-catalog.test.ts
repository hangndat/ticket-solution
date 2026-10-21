import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogArtLabel,
  catalogArtTone,
} from '../src/ui/event-media';

test('catalogArtTone is deterministic from event id', () => {
  const tone = catalogArtTone('d9d9f001-0002-4000-8000-000000000001');
  assert.equal(catalogArtTone('d9d9f001-0002-4000-8000-000000000001'), tone);
  assert.ok(['default', 'green', 'gold'].includes(tone));
});

test('catalogArtLabel uses initials for multi-word names', () => {
  assert.equal(catalogArtLabel('Studio Night'), 'SN');
  assert.equal(catalogArtLabel('Studio'), 'ST');
  assert.equal(catalogArtLabel('  '), '·');
});
