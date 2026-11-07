import assert from 'node:assert/strict';
import { test } from 'node:test';
import { walletContentPhase } from './wallet-content-phase.ts';

const initial = {
  ticketCount: 0,
  busy: false,
  error: null,
  onlineLoaded: false,
  offline: false,
};

test('empty owner wallet is confirmed only after a successful online load', () => {
  assert.equal(walletContentPhase(initial), 'idle');
  assert.equal(walletContentPhase({ ...initial, busy: true }), 'loading');
  assert.equal(walletContentPhase({ ...initial, onlineLoaded: true }), 'empty-online');
});

test('401 and unreachable beat empty, including after a prior empty success', () => {
  for (const error of ['Phiên không còn được phép xem vé.', 'Không tải được vé từ máy chủ.']) {
    assert.equal(walletContentPhase({ ...initial, error }), 'error');
    assert.equal(walletContentPhase({ ...initial, busy: true, error }), 'error');
    assert.equal(walletContentPhase({ ...initial, onlineLoaded: true, error }), 'error');
  }
});

test('error to retry to successful empty clears the error phase', () => {
  const error = walletContentPhase({ ...initial, error: 'Không tải được vé từ máy chủ.' });
  const retrying = walletContentPhase({ ...initial, busy: true });
  const success = walletContentPhase({ ...initial, onlineLoaded: true });
  assert.deepEqual([error, retrying, success], ['error', 'loading', 'empty-online']);
});

test('owner-bound offline cache keeps rows while a refresh has an error', () => {
  assert.equal(walletContentPhase({ ...initial, ticketCount: 1, offline: true, error: 'Mất kết nối.' }), 'tickets');
  assert.equal(walletContentPhase({ ...initial, offline: true, error: 'Mất kết nối.' }), 'error');
  assert.equal(walletContentPhase({ ...initial, offline: true }), 'empty-offline');
});
