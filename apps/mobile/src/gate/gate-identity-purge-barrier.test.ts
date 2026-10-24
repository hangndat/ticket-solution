import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGateIdentityPurgeBarrier } from './gate-identity-purge-barrier.ts';

test('later verified switch cannot forget an earlier failed user partition purge', async () => {
  const purged: string[] = [];
  const barrier = createGateIdentityPurgeBarrier(async (userId) => {
    purged.push(userId);
    if (userId === 'A') throw new Error('A deletion failed');
  });
  barrier.observe('A');
  barrier.observe(null); // unreachable retains A v2
  barrier.observe('B');
  await assert.rejects(barrier.wait(), /A deletion failed/);
  barrier.observe('C');
  await assert.rejects(barrier.wait(), /A deletion failed/);
  assert.deepEqual(purged, ['A', 'B']);
});
