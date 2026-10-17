import assert from 'node:assert/strict';
import test from 'node:test';
import { surfaceStateClass } from '../src/ui/surface-state';

test('surfaceStateClass maps every kind to shared state chrome', () => {
  assert.equal(surfaceStateClass('empty'), 'surface-state state-empty');
  assert.equal(surfaceStateClass('loading'), 'surface-state state-loading');
  assert.equal(surfaceStateClass('error'), 'surface-state state-error');
  assert.equal(surfaceStateClass('unknown'), 'surface-state state-unknown');
});
