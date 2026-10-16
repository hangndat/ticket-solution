import assert from 'node:assert/strict';
import test from 'node:test';
import { ISSUE_ERROR_CODES } from '@ticket/contracts';
import { fetchJson } from '../src/redeem/fetch-json';
import {
  messageForApiError,
  networkMessage,
  timeoutMessage,
} from '../src/redeem/messages';
import { pollOperation } from '../src/redeem/poll-operation';
import type { FetchJsonResult } from '../src/redeem/fetch-json';

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
      onSuccess: () => {
        successCount += 1;
      },
      onError: () => {},
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
      onSuccess: (body) => {
        gotTicket = body.ticketId;
      },
      onError: () => {},
      onFinally: () => {
        polling = false;
      },
    },
    {
      fetchJsonImpl: async (): Promise<FetchJsonResult> => {
        calls += 1;
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
});

test('pollOperation maps FAILED ApiError without claiming success', async () => {
  let errorCode: string | undefined;
  let success = false;
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
      onSuccess: () => {
        success = true;
      },
      onError: (body) => {
        if (body && typeof body === 'object' && 'code' in body) {
          errorCode = String((body as { code: string }).code);
        }
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

  assert.equal(success, false);
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
  assert.match(networkMessage().detail, /idempotency-key/i);
});
