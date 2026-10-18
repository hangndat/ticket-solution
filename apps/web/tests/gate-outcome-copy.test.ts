import assert from 'node:assert/strict';
import test from 'node:test';
import { presentGateDecision } from '../src/gate/gate-outcome-copy';
import { BLOCKED_DEGRADED_DECISION } from '../src/gate/offline-messages';

test('unknown never uses admit tone', () => {
  const view = presentGateDecision({ kind: 'unknown', message: 'Chưa rõ.' });
  assert.equal(view.tone, 'unknown');
  assert.notEqual(view.tone, 'admit');
  assert.equal(view.assertive, true);
});

test('degraded blocked decision stays non-admit', () => {
  const view = presentGateDecision(BLOCKED_DEGRADED_DECISION);
  assert.equal(view.kind, 'unknown');
  assert.equal(view.tone, 'unknown');
  assert.match(view.title, /Chưa rõ/);
});
