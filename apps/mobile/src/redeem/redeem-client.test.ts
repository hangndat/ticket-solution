import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REDEEM_UNKNOWN, decideRedeemBody, redeemCode } from './redeem-client.ts';

const key = '77777777-7777-4777-8777-777777777777';

test('201 with an active ticket is issued', () => {
  const decision = decideRedeemBody(
    201,
    { ticketId: '11111111-1111-4111-8111-111111111111', state: 'ACTIVE', replayed: false },
    key,
  );
  assert.equal(decision.kind, 'issued');
});

test('timeout then operation lookup does not invent a ticket', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/redemptions')) {
      throw new TypeError('network down');
    }
    return new Response(
      JSON.stringify({ status: 'IN_PROGRESS', response: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const decision = await redeemCode({
    apiBase: 'http://127.0.0.1:3001',
    bearer: 'token',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    code: 'INVITE-1',
    idempotencyKey: key,
    fetchImpl,
  });
  assert.equal(decision.kind, 'unknown');
  if (decision.kind === 'unknown') {
    assert.equal(decision.idempotencyKey, key);
    assert.equal(decision.message, REDEEM_UNKNOWN);
  }
});

test('completed operation with a ticket is issued; business rejection is denied', async () => {
  const issued = decideRedeemBody(
    200,
    {
      status: 'COMPLETED',
      response: {
        ticketId: '11111111-1111-4111-8111-111111111111',
        state: 'ACTIVE',
        replayed: true,
      },
    },
    key,
  );
  assert.equal(issued.kind, 'issued');
  const denied = decideRedeemBody(
    409,
    { code: 'CODE_CONSUMED', message: 'Already used' },
    key,
  );
  assert.equal(denied.kind, 'denied');
  if (denied.kind === 'denied') assert.equal(denied.code, 'CODE_CONSUMED');
});
