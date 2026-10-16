import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDurableWriteGate } from './durable-write-gate.ts';

test('durable write gate bumps epoch so callers can drop late writes', () => {
  const gate = createDurableWriteGate();
  const before = gate.current();
  const after = gate.invalidate();
  assert.equal(after, before + 1);
  assert.equal(gate.current(), after);
  assert.equal(gate.isCurrent(before), false);
  assert.equal(gate.isCurrent(after), true);
});
