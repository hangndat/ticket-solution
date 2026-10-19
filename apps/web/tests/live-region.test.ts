import assert from 'node:assert/strict';
import test from 'node:test';
import { liveRegionForStatus } from '../src/ui/live-region';

test('unknown / queued / error outcomes use assertive alert', () => {
  for (const kind of [
    'unknown',
    'queued',
    'error',
    'denied',
    'expired',
    'auth',
  ] as const) {
    const live = liveRegionForStatus(kind);
    assert.equal(live.role, 'alert');
    assert.equal(live.ariaLive, 'assertive');
    assert.equal(live.ariaAtomic, true);
  }
});

test('pending / success / idle stay polite status (queued≠admit on web)', () => {
  for (const kind of ['pending', 'success', 'idle', 'verifying', 'polling']) {
    const live = liveRegionForStatus(kind);
    assert.equal(live.role, 'status');
    assert.equal(live.ariaLive, 'polite');
    assert.equal(live.ariaAtomic, true);
  }
});
