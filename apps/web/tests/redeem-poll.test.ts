import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVAL_PENDING, ISSUE_ERROR_CODES, REDEMPTION_COMMAND } from '@ticket/contracts';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
} from '../src/redeem/attempt-key';
import { fetchJson } from '../src/redeem/fetch-json';
import {
  messageForApiError,
  networkMessage,
  timeoutMessage,
} from '../src/redeem/messages';
import { pollOperation } from '../src/redeem/poll-operation';
import { fetchOwnerRedemptionStatus } from '../src/redeem/owner-status';
import type { FetchJsonResult } from '../src/redeem/fetch-json';
import type { RedeemDecision } from '../src/redeem/decide';

test('owner redemption status sends tenant scope required by API', async () => {
  let requestedUrl = '';
  const result = await fetchOwnerRedemptionStatus(
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        status: 'ISSUED',
        requestId: '55555555-5555-4555-8555-555555555555',
        eventId: '22222222-2222-4222-8222-222222222222',
        ticketId: '33333333-3333-4333-8333-333333333333',
        ticketTypeId: '44444444-4444-4444-8444-444444444444',
        sourceId: '66666666-6666-4666-8666-666666666666',
        issuedAt: '2026-10-26T00:00:00.000Z',
      }), { status: 200 });
    },
  );
  assert.equal(
    requestedUrl,
    '/api/bff/redemptions/55555555-5555-4555-8555-555555555555?tenantId=11111111-1111-4111-8111-111111111111',
  );
  assert.equal(result.status, 'ok');
});

test('fetchJson maps TypeError network failure without throwing', async () => {
  const result = await fetchJson(
    '/api/bff/operations/key',
    { method: 'GET' },
    1_000,
    async () => {
      throw new TypeError('Failed to fetch');
    },
  );
  assert.equal(result.networkError, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.status, 0);
  assert.equal(result.json, null);
});

test('fetchJson maps AbortError to timedOut', async () => {
  const result = await fetchJson(
    '/api/bff/operations/key',
    { method: 'GET' },
    1_000,
    async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    },
  );
  assert.equal(result.timedOut, true);
  assert.equal(result.networkError, false);
});

test('pollOperation clears busy after consecutive network rejections (no stuck polling)', async () => {
  let polling = false;
  let finallyCount = 0;
  let successCount = 0;
  const transients: string[] = [];

  const outcome = await pollOperation(
    'idem-key-1',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    {
      onStart: () => {
        polling = true;
      },
      onRaw: () => {},
      onTransient: (kind) => {
        transients.push(kind);
      },
      onDecision: (d) => {
        if (d.kind === 'issued') successCount += 1;
      },
      onFinally: () => {
        polling = false;
        finallyCount += 1;
      },
    },
    {
      fetchJsonImpl: async () =>
        ({
          status: 0,
          json: null,
          timedOut: false,
          networkError: true,
        }) satisfies FetchJsonResult,
      sleep: async () => {},
      now: (() => {
        let t = 0;
        return () => {
          t += 1;
          return t;
        };
      })(),
      pollMaxMs: 100,
      pollIntervalMs: 0,
      maxConsecutiveNetwork: 3,
      requestTimeoutMs: 50,
    },
  );

  assert.equal(outcome, 'timeout');
  assert.equal(polling, false);
  assert.equal(finallyCount, 1);
  assert.equal(successCount, 0);
  assert.ok(transients.every((k) => k === 'network'));
  assert.ok(transients.length >= 3);
});

test('pollOperation recovers after network rejection then COMPLETED redeem', async () => {
  let polling = true;
  let gotTicket: string | null = null;
  let calls = 0;
  let usedCommand = '';

  const redeemBody = {
    ticketId: '33333333-3333-4333-8333-333333333333',
    requestId: 'req-1',
    operationId: 'op-1',
    state: 'ACTIVE' as const,
    eventId: '22222222-2222-4222-8222-222222222222',
    ticketTypeId: 'tt-1',
    sourceId: 'src-1',
    credentialVersion: 1,
    replayed: false,
  };

  const outcome = await pollOperation(
    'idem-key-2',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    {
      onStart: () => {
        polling = true;
      },
      onRaw: () => {},
      onTransient: () => {},
      onDecision: (d: RedeemDecision) => {
        if (d.kind === 'issued') gotTicket = d.ticketId;
      },
      onFinally: () => {
        polling = false;
      },
    },
    {
      fetchJsonImpl: async (input): Promise<FetchJsonResult> => {
        calls += 1;
        const url = String(input);
        usedCommand = new URL(url, 'http://local.test').searchParams.get('command') ?? '';
        if (calls === 1) {
          return { status: 0, json: null, timedOut: false, networkError: true };
        }
        return {
          status: 200,
          json: { status: 'COMPLETED', response: redeemBody },
          timedOut: false,
          networkError: false,
        };
      },
      sleep: async () => {},
      now: (() => {
        let t = 0;
        return () => ++t;
      })(),
      pollMaxMs: 50,
      pollIntervalMs: 0,
      maxConsecutiveNetwork: 5,
    },
  );

  assert.equal(outcome, 'success');
  assert.equal(gotTicket, redeemBody.ticketId);
  assert.equal(polling, false);
  assert.equal(calls, 2);
  assert.equal(usedCommand, REDEMPTION_COMMAND);
});

test('pollOperation maps COMPLETED pending without claiming ticket', async () => {
  let kind: RedeemDecision['kind'] | null = null;

  await pollOperation(
    'idem-key-pending',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    {
      onStart: () => {},
      onRaw: () => {},
      onTransient: () => {},
      onDecision: (d) => {
        kind = d.kind;
      },
      onFinally: () => {},
    },
    {
      fetchJsonImpl: async () =>
        ({
          status: 200,
          json: {
            status: 'COMPLETED',
            response: {
              code: APPROVAL_PENDING,
              requestId: '55555555-5555-4555-8555-555555555555',
              operationId: 'op',
              eventId: '22222222-2222-4222-8222-222222222222',
              ticketTypeId: 'tt',
              sourceId: 'src',
              status: 'PENDING_REVIEW',
              replayed: false,
            },
          },
          timedOut: false,
          networkError: false,
        }) satisfies FetchJsonResult,
      sleep: async () => {},
      now: () => 0,
      pollMaxMs: 10,
    },
  );

  assert.equal(kind, 'pending');
});

test('pollOperation maps FAILED ApiError without claiming success', async () => {
  let errorCode: string | undefined;
  let issued = false;
  let polling = true;

  await pollOperation(
    'idem-key-3',
    't',
    'e',
    {
      onStart: () => {
        polling = true;
      },
      onRaw: () => {},
      onTransient: () => {},
      onDecision: (d) => {
        if (d.kind === 'issued') issued = true;
        if (d.kind === 'denied') errorCode = d.code;
      },
      onFinally: () => {
        polling = false;
      },
    },
    {
      fetchJsonImpl: async () =>
        ({
          status: 200,
          json: {
            status: 'FAILED',
            response: {
              code: ISSUE_ERROR_CODES.QUOTA_EXHAUSTED,
              message: 'quota',
            },
          },
          timedOut: false,
          networkError: false,
        }) satisfies FetchJsonResult,
      sleep: async () => {},
      now: () => 0,
      pollMaxMs: 10,
    },
  );

  assert.equal(issued, false);
  assert.equal(errorCode, ISSUE_ERROR_CODES.QUOTA_EXHAUSTED);
  assert.equal(polling, false);
});

test('exhausted/used/timeout UX kinds remain distinct and network is retryable timeout-kind', () => {
  assert.equal(messageForApiError(ISSUE_ERROR_CODES.QUOTA_EXHAUSTED).kind, 'exhausted');
  assert.equal(messageForApiError(ISSUE_ERROR_CODES.CODE_CONSUMED).kind, 'used');
  assert.equal(timeoutMessage().kind, 'timeout');
  assert.equal(timeoutMessage().retryable, true);
  assert.equal(networkMessage().kind, 'timeout');
  assert.equal(networkMessage().retryable, true);
  assert.match(networkMessage().detail, /chưa chắc đã có vé/i);
  assert.match(networkMessage().detail, /đừng gửi mã lần nữa/i);
});

test('resolveIdempotencyKey reuses key only when unclear + same payload incl answers', () => {
  const payload = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    eventId: '22222222-2222-4222-8222-222222222222',
    code: 'CODE-A',
    formVersion: 'form-v1',
    termsVersion: 'terms-v1',
    answers: { full_name: 'Ada' },
    termsAccepted: true,
  };
  const fingerprint = redeemPayloadFingerprint(payload);
  const existing = { key: 'keep-me', fingerprint, unclear: true };

  const reused = resolveIdempotencyKey(existing, fingerprint, () => 'fresh-1');
  assert.equal(reused.reused, true);
  assert.equal(reused.key, 'keep-me');

  const afterClear = resolveIdempotencyKey(
    { ...existing, unclear: false },
    fingerprint,
    () => 'fresh-2',
  );
  assert.equal(afterClear.reused, false);
  assert.equal(afterClear.key, 'fresh-2');

  const changed = resolveIdempotencyKey(
    existing,
    redeemPayloadFingerprint({ ...payload, answers: { full_name: 'Bob' } }),
    () => 'fresh-3',
  );
  assert.equal(changed.reused, false);
  assert.equal(changed.key, 'fresh-3');
});
