import assert from 'node:assert/strict';
import test from 'node:test';
import { colorMixInSrgb } from './color-mix.ts';

test('colorMixInSrgb matches web attendeePrimary stop (signal 88%, ink)', () => {
  const mixed = colorMixInSrgb('#E11D48', '#0B1220', 0.88);
  assert.equal(mixed, '#c71c43');
});
