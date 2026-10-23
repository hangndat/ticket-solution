import assert from 'node:assert/strict';
import test from 'node:test';
import { surfaceStateClass } from '../src/ui/surface-state';

test('surfaceStateClass maps every kind to Tailwind surface chrome', () => {
  for (const kind of ['empty', 'loading', 'error', 'unknown'] as const) {
    const cls = surfaceStateClass(kind);
    assert.match(cls, /max-w-\[42rem\]/);
    assert.match(cls, /grid/);
  }
  assert.match(surfaceStateClass('error'), /destructive/);
  assert.match(surfaceStateClass('loading'), /animate-pulse/);
});
