import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishedDetailPhaseFromResult } from './event-detail-state.ts';

test('missing or unpublished detail is unavailable without retry', () => {
  assert.deepEqual(publishedDetailPhaseFromResult({ status: 'not-found' }),
    { kind: 'not-found' });
});

test('only connectivity failure offers retry', () => {
  const unreachable = publishedDetailPhaseFromResult({ status: 'unreachable' });
  const invalid = publishedDetailPhaseFromResult({ status: 'invalid' });
  assert.equal(unreachable.kind, 'error');
  assert.equal(invalid.kind, 'error');
  if (unreachable.kind === 'error' && invalid.kind === 'error') {
    assert.equal(unreachable.retryable, true);
    assert.equal(invalid.retryable, false);
  }
  assert.deepEqual(publishedDetailPhaseFromResult({ status: 'misconfigured' }),
    { kind: 'misconfigured' });
});
