import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
} from './attempt-key.ts';
import { APPROVAL_PENDING, REDEEM_COMMAND } from './contract.ts';
import { REDEMPTION_RESOLVE_HEADER } from '@ticket/contracts';
import {
  PENDING_NOT_TICKET,
  REDEEM_UNKNOWN,
  decideRedeemBody,
  reconcileRedeem,
  redeemCode,
} from './redeem-client.ts';

const key = '77777777-7777-4777-8777-777777777777';

test('201 with an active ticket is issued', () => {
  const decision = decideRedeemBody(
    201,
    { ticketId: '11111111-1111-4111-8111-111111111111', state: 'ACTIVE', replayed: false },
    key,
  );
  assert.equal(decision.kind, 'issued');
});

test('APPROVAL_PENDING is pending — never denied or issued', () => {
  const decision = decideRedeemBody(
    200,
    {
      code: APPROVAL_PENDING,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventId: '33333333-3333-4333-8333-333333333333',
      ticketTypeId: 'tt',
      sourceId: 'src',
      status: 'PENDING_REVIEW',
      replayed: false,
    },
    key,
  );
  assert.equal(decision.kind, 'pending');
  if (decision.kind === 'pending') {
    assert.equal(decision.requestId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(decision.message, PENDING_NOT_TICKET);
  }
});

test('completed operation with pending body is pending not denied', () => {
  const decision = decideRedeemBody(
    200,
    {
      status: 'COMPLETED',
      response: {
        code: APPROVAL_PENDING,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        operationId: 'op',
        eventId: 'ev',
        ticketTypeId: 'tt',
        sourceId: 'src',
        status: 'PENDING_REVIEW',
        replayed: true,
      },
    },
    key,
  );
  assert.equal(decision.kind, 'pending');
});

test('timeout then operation lookup does not invent a ticket', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/redemptions')) {
      throw new TypeError('network down');
    }
    assert.match(url, /command=redemption\.redeem/);
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
    formVersion: 'f-1',
    termsVersion: 't-1',
    answers: { name: 'Ada' },
    termsAccepted: true,
    fetchImpl,
  });
  assert.equal(decision.kind, 'unknown');
  if (decision.kind === 'unknown') {
    assert.equal(decision.idempotencyKey, key);
    assert.equal(decision.message, REDEEM_UNKNOWN);
  }
});

test('reconcileRedeem uses shared redemption.redeem command', async () => {
  let seen = '';
  const fetchImpl: typeof fetch = async (input) => {
    seen = String(input);
    return new Response(
      JSON.stringify({
        status: 'COMPLETED',
        response: {
          ticketId: '11111111-1111-4111-8111-111111111111',
          state: 'ACTIVE',
          replayed: true,
        },
      }),
      { status: 200 },
    );
  };
  const decision = await reconcileRedeem({
    apiBase: 'http://127.0.0.1:3001',
    bearer: 'token',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    idempotencyKey: key,
    fetchImpl,
  });
  assert.equal(decision.kind, 'issued');
  assert.match(seen, new RegExp(`command=${encodeURIComponent(REDEEM_COMMAND)}`));
  assert.doesNotMatch(seen, /command=redeem(?:&|$)/);
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

test('stale form/terms codes are stale not denied ticket', () => {
  const stale = decideRedeemBody(
    409,
    { code: 'FORM_VERSION_STALE', message: 'Reload form' },
    key,
  );
  assert.equal(stale.kind, 'stale');
});

test('attempt fingerprint includes answers and consent; changed answers get new key', () => {
  const base = {
    tenantId: 't',
    eventId: 'e',
    code: 'abc',
    formVersion: 'f1',
    termsVersion: 't1',
    answers: { name: 'Ada' },
    termsAccepted: true,
  };
  const fp1 = redeemPayloadFingerprint(base);
  const fp2 = redeemPayloadFingerprint({
    ...base,
    answers: { name: 'Bob' },
  });
  assert.notEqual(fp1, fp2);
  const reused = resolveIdempotencyKey(
    { key, fingerprint: fp1, unclear: true },
    fp1,
    () => 'new-key',
  );
  assert.equal(reused.reused, true);
  assert.equal(reused.key, key);
  const fresh = resolveIdempotencyKey(
    { key, fingerprint: fp1, unclear: true },
    fp2,
    () => 'new-key',
  );
  assert.equal(fresh.reused, false);
  assert.equal(fresh.key, 'new-key');
});

test('redeem POST sends resolve token header when provided', async () => {
  let headers: Record<string, string> = {};
  const fetchImpl: typeof fetch = async (_input, init) => {
    headers = init?.headers as Record<string, string>;
    return new Response(
      JSON.stringify({
        ticketId: '11111111-1111-4111-8111-111111111111',
        state: 'ACTIVE',
        replayed: false,
      }),
      { status: 201 },
    );
  };
  await redeemCode({
    apiBase: 'http://127.0.0.1:3001',
    bearer: 'token',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    code: 'INVITE-1',
    idempotencyKey: key,
    resolveToken: 'resolve-tok',
    fetchImpl,
  });
  assert.equal(headers[REDEMPTION_RESOLVE_HEADER], 'resolve-tok');
});

test('redeem POST body carries form/terms/answers/consent', async () => {
  let posted: unknown = null;
  const fetchImpl: typeof fetch = async (_input, init) => {
    posted = JSON.parse(String(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({
        ticketId: '11111111-1111-4111-8111-111111111111',
        state: 'ACTIVE',
        replayed: false,
      }),
      { status: 201 },
    );
  };
  await redeemCode({
    apiBase: 'http://127.0.0.1:3001',
    bearer: 'token',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    code: 'INVITE-1',
    idempotencyKey: key,
    formVersion: 'f-1',
    termsVersion: 't-1',
    answers: { email: 'a@b.co', agree: true },
    termsAccepted: true,
    fetchImpl,
  });
  assert.deepEqual(posted, {
    code: 'INVITE-1',
    formVersion: 'f-1',
    termsVersion: 't-1',
    answers: { email: 'a@b.co', agree: true },
    termsAccepted: true,
  });
});
