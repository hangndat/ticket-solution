import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  effectiveSelectedGate,
  parseGateList,
  resolveOpenSessionUi,
  type GatesLoadState,
} from './staff-gate-gates.ts';

const A = { id: '11111111-1111-4111-8111-111111111111', name: 'Cổng A', sortOrder: 1 };
const B = { id: '22222222-2222-4222-8222-222222222222', name: 'Cổng B', sortOrder: 2 };
const ready = (gates: typeof A[]): GatesLoadState => ({ key: 'k', status: 'ready', gates });

test('parseGateList validates shape', () => {
  assert.deepEqual(parseGateList({ gates: [{ ...A }] }), [A]);
  assert.deepEqual(parseGateList({ gates: [] }), []);
  assert.equal(parseGateList({ gates: [{ id: 'x', name: 'n' }] }), null);
  assert.equal(parseGateList(null), null);
});

test('effectiveSelectedGate: explicit, single auto, none', () => {
  assert.equal(effectiveSelectedGate([A, B], B.id), B);
  assert.equal(effectiveSelectedGate([A, B], null), null);
  assert.equal(effectiveSelectedGate([A], null), A);
  assert.equal(effectiveSelectedGate([A, B], 'gone'), null);
});

test('open-session UI: picker only with gates; button also without gates', () => {
  const base = { hasScope: true, hasSession: false, opening: false };
  const none = resolveOpenSessionUi({ ...base, gates: ready([]), selected: null });
  assert.deepEqual(none, { explicitOpen: true, showPicker: false, scanFallback: false, canOpen: true });
  const two = resolveOpenSessionUi({ ...base, gates: ready([A, B]), selected: null });
  assert.equal(two.showPicker, true);
  assert.equal(two.canOpen, false);
  assert.equal(resolveOpenSessionUi({ ...base, gates: ready([A, B]), selected: B }).canOpen, true);
  assert.equal(resolveOpenSessionUi({ ...base, gates: ready([A]), selected: A, opening: true }).canOpen, false);
});

test('open-session UI: loading, error fallback, session open, no scope', () => {
  const base = { hasScope: true, hasSession: false, opening: false, selected: null };
  assert.equal(resolveOpenSessionUi({ ...base, gates: null }).canOpen, false);
  assert.equal(resolveOpenSessionUi({ ...base, gates: null }).explicitOpen, true);
  const err = resolveOpenSessionUi({ ...base, gates: { key: 'k', status: 'error', gates: [] } });
  assert.equal(err.scanFallback, true);
  assert.equal(err.explicitOpen, false);
  assert.equal(resolveOpenSessionUi({ ...base, hasSession: true, gates: ready([A]) }).explicitOpen, false);
  assert.equal(resolveOpenSessionUi({ ...base, hasScope: false, gates: ready([A]) }).explicitOpen, false);
});
