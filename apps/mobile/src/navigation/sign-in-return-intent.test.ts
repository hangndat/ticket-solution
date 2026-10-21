import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearSignInReturn,
  clearSignInReturnIfPath,
  consumeSignInReturn,
  parkSignInReturn,
  peekSignInReturn,
} from './sign-in-return-intent.ts';

test('park and consume allowed return paths', () => {
  clearSignInReturn();
  assert.equal(parkSignInReturn({ pathname: '/redeem' }), true);
  assert.deepEqual(peekSignInReturn(), { pathname: '/redeem-global' });
  assert.deepEqual(consumeSignInReturn(), { pathname: '/redeem-global' });
  assert.equal(peekSignInReturn(), null);
});

test('rejects query strings and unknown paths', () => {
  clearSignInReturn();
  assert.equal(parkSignInReturn({ pathname: '/claim?token=secret' }), false);
  assert.equal(parkSignInReturn({ pathname: '/evil' }), false);
  assert.equal(peekSignInReturn(), null);
});

test('clearSignInReturnIfPath only drops matching path', () => {
  clearSignInReturn();
  parkSignInReturn({ pathname: '/redeem' });
  clearSignInReturnIfPath('/claim');
  assert.deepEqual(peekSignInReturn(), { pathname: '/redeem-global' });
  clearSignInReturnIfPath('/redeem');
  assert.equal(peekSignInReturn(), null);
});

test('allows global redeem return path', () => {
  clearSignInReturn();
  assert.equal(parkSignInReturn({ pathname: '/redeem-global' }), true);
  assert.equal(consumeSignInReturn()?.pathname, '/redeem-global');
});

test('allows ticket detail path without query', () => {
  clearSignInReturn();
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(parkSignInReturn({ pathname: `/my-tickets/${id}` }), true);
  assert.equal(consumeSignInReturn()?.pathname, `/my-tickets/${id}`);
});
