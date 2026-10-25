import assert from 'node:assert/strict';
import test from 'node:test';
import { colorMixInSrgb } from './color-mix.ts';

test('colorMixInSrgb mixes primary violet toward ink', () => {
  const mixed = colorMixInSrgb('#7C4DED', '#0B1220', 0.88);
  assert.equal(mixed, '#6e46d4');
});
