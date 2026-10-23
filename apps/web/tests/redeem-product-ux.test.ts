import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REDEEM_PRODUCT_OUTCOME_ERROR_KINDS,
  REDEEM_PRODUCT_PANEL_ERROR_KINDS,
  redeemProductErrorOutcome,
  redeemProductUxClass,
} from '../src/redeem/redeem-surface';

test('product panel error kinds include stale, timeout, auth (main parity)', () => {
  assert.deepEqual([...REDEEM_PRODUCT_PANEL_ERROR_KINDS].sort(), [
    'auth',
    'closed',
    'conflict',
    'denied',
    'error',
    'exhausted',
    'invalid',
    'stale',
    'timeout',
    'used',
  ]);
});

test('product outcome error kinds exclude stale, timeout, auth (main parity)', () => {
  assert.deepEqual([...REDEEM_PRODUCT_OUTCOME_ERROR_KINDS].sort(), [
    'closed',
    'conflict',
    'denied',
    'error',
    'exhausted',
    'invalid',
    'used',
  ]);
  for (const kind of ['stale', 'timeout', 'auth'] as const) {
    assert.equal(redeemProductErrorOutcome(kind), false);
  }
});

test('redeemProductUxClass applies error panel chrome for panel error kinds only', () => {
  const referenceError = redeemProductUxClass('error');
  const neutral = redeemProductUxClass('verifying');

  for (const kind of REDEEM_PRODUCT_PANEL_ERROR_KINDS) {
    const cls = redeemProductUxClass(kind);
    assert.notEqual(cls, neutral);
    assert.equal(cls, referenceError);
  }

  assert.notEqual(redeemProductUxClass('success'), referenceError);
  assert.equal(redeemProductUxClass('polling'), neutral);
});
