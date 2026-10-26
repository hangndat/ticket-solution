import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import { classifySupervisorOp } from './gate-scan.ts';
import { presentGateOutcome } from './gate-outcome-copy.ts';
import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import {
  fetchOfflineSyncReceipt,
  gateOpFromHistoricalReceipt,
  historicalReceiptMessage,
  opNeedsHistoricalReceiptLookup,
  parseOfflineSyncReceiptResponse,
  receiptMatchesGateOp,
  reconcileOpsWithHistoricalReceipts,
} from './offline-sync-receipt.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import { OFFLINE_SYNC_PAYLOAD_VERSION } from './offline-sync-contract.ts';

const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const ticketId = '11111111-1111-4111-8111-111111111111';
const staffSessionId = '44444444-4444-4444-8444-444444444444';
const clientEventId = '6c812d24-2d8e-44eb-b55d-23c358e75f09';
const checkinId = '46a428ee-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const validReceipt = {
  tenantId,
  eventId,
  clientEventId,
  status: 'APPLIED' as const,
  historical: true as const,
  ticketId,
  checkinId,
  staffSessionId,
  appliedAt: '2026-10-23T12:00:00.000Z',
  checkinState: 'CURRENT' as const,
};

function queuedOp(): GateOp {
  return {
    id: clientEventId,
    ticketId,
    tenantId,
    eventId,
    staffSessionId,
    clientEventId,
    phase: 'queued',
    message: 'offline',
  };
}

function queueRow(
  localStatus: QueuedOfflineScan['localStatus'],
): QueuedOfflineScan {
  return {
    clientEventId,
    type: 'CHECKIN_OFFLINE',
    eventId,
    ticketId,
    tenantId,
    staffSessionId,
    clientOccurredAt: '2026-10-23T11:00:00.000Z',
    clientSeq: 0,
    payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
    localStatus,
  };
}

test('parseOfflineSyncReceiptResponse rejects malformed bodies', () => {
  assert.equal(parseOfflineSyncReceiptResponse(null), null);
  assert.equal(
    parseOfflineSyncReceiptResponse({ ...validReceipt, historical: false }),
    null,
  );
  assert.equal(
    parseOfflineSyncReceiptResponse({ ...validReceipt, status: 'PENDING' }),
    null,
  );
  assert.equal(
    parseOfflineSyncReceiptResponse({ ...validReceipt, appliedAt: 'not-iso' }),
    null,
  );
  assert.equal(parseOfflineSyncReceiptResponse(validReceipt)?.checkinState, 'CURRENT');
});

test('historical receipt CURRENT is neutral recorded, never admission', () => {
  const op = gateOpFromHistoricalReceipt(queuedOp(), validReceipt);
  assert.equal(op.phase, 'recorded');
  assert.equal(op.checkinId, checkinId);
  assert.equal(op.admissionKind, undefined);
  assert.equal(classifySupervisorOp(op), 'not-admission');
  const outcome = presentGateOutcome(op);
  assert.equal(outcome.kind, 'recorded');
  assert.equal(outcome.tone, 'unknown');
  const panel = presentGateScanStatus({ busy: false, op, canReconcile: false });
  assert.equal(panel.kind, 'recorded');
  assert.notEqual(panel.tone, 'admit');
  assert.match(op.message, /Đã ghi nhận trước đó/);
});

for (const state of [
  'UNDONE',
  'TICKET_REVOKED',
  'NO_LONGER_CURRENT',
] as const) {
  test(`historical receipt copy for ${state}`, () => {
    const message = historicalReceiptMessage(state);
    assert.match(message, /Đã ghi nhận trước đó/);
    if (state === 'UNDONE') assert.match(message, /hoàn tác/i);
    if (state === 'TICKET_REVOKED') assert.match(message, /thu hồi/i);
  });
}

test('receipt mismatch leaves op unchanged', () => {
  const op = queuedOp();
  const bad = { ...validReceipt, ticketId: '99999999-9999-4999-8999-999999999999' };
  assert.equal(receiptMatchesGateOp(bad, op), false);
  assert.equal(gateOpFromHistoricalReceipt(op, bad).phase, 'queued');
});

test('fetch 404 does not mutate ops', async () => {
  const ops = [queuedOp()];
  const next = await reconcileOpsWithHistoricalReceipts({
    ops,
    queueItems: [],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => true,
    fetchImpl: async () => new Response('', { status: 404 }),
  });
  assert.equal(next[0]?.phase, 'queued');
});

test('fetch 200 with mismatch ids is malformed guard', async () => {
  const ops = [queuedOp()];
  const next = await reconcileOpsWithHistoricalReceipts({
    ops,
    queueItems: [],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => true,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ...validReceipt,
          clientEventId: '00000000-0000-4000-8000-000000000001',
        }),
        { status: 200 },
      ),
  });
  assert.equal(next[0]?.phase, 'unknown');
});

test('orphan unknown reconciles to recorded', async () => {
  const orphan: GateOp = { ...queuedOp(), phase: 'unknown', message: 'orphan' };
  const next = await reconcileOpsWithHistoricalReceipts({
    ops: [orphan],
    queueItems: [],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => true,
    fetchImpl: async () => new Response(JSON.stringify(validReceipt), { status: 200 }),
  });
  assert.equal(next[0]?.phase, 'recorded');
  assert.equal(next[0]?.checkinId, checkinId);
});

test('stale guard after first await discards partial recorded apply', async () => {
  let calls = 0;
  let allow = true;
  const ops = [queuedOp()];
  const next = await reconcileOpsWithHistoricalReceipts({
    ops,
    queueItems: [],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => allow,
    fetchImpl: async () => {
      calls += 1;
      allow = false;
      return new Response(JSON.stringify(validReceipt), { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(next[0]?.phase, 'queued');
  assert.equal(next[0], ops[0]);
});

test('deferred second lookup after generation loss discards first lookup apply', async () => {
  const clientEventId2 = '00000000-0000-4000-8000-000000000002';
  const ticketId2 = '22222222-2222-4222-8222-222222222222';
  const op1 = queuedOp();
  const op2: GateOp = {
    ...queuedOp(),
    id: 'op-2',
    clientEventId: clientEventId2,
    ticketId: ticketId2,
  };
  const ops = [op1, op2];
  const receipt2 = {
    ...validReceipt,
    clientEventId: clientEventId2,
    ticketId: ticketId2,
  };
  let allow = true;
  let fetchPhase = 0;
  let releaseOp2!: () => void;
  const op2Blocked = new Promise<void>((resolve) => {
    releaseOp2 = resolve;
  });
  let op2FetchEntered!: () => void;
  const op2FetchStarted = new Promise<void>((resolve) => {
    op2FetchEntered = resolve;
  });

  const reconcilePromise = reconcileOpsWithHistoricalReceipts({
    ops,
    queueItems: [],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => allow,
    fetchImpl: async () => {
      if (fetchPhase === 0) {
        fetchPhase = 1;
        return new Response(JSON.stringify(validReceipt), { status: 200 });
      }
      op2FetchEntered();
      await op2Blocked;
      return new Response(JSON.stringify(receipt2), { status: 200 });
    },
  });

  await op2FetchStarted;
  allow = false;
  releaseOp2();
  const next = await reconcilePromise;

  assert.equal(next[0]?.phase, 'queued');
  assert.equal(next[1]?.phase, 'queued');
  assert.equal(next[0], op1);
  assert.equal(next[1], op2);
});

test('fetchOfflineSyncReceipt aborts hung fetch without blocking chain', async () => {
  let sawAbort = false;
  const result = await fetchOfflineSyncReceipt({
    bearer: 'tok',
    apiBase: 'https://api.example',
    tenantId,
    eventId,
    clientEventId,
    timeoutMs: 25,
    fetchImpl: async (_url, init) => {
      const signal = init?.signal;
      if (!signal) {
        return new Response('', { status: 500 });
      }
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          sawAbort = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    },
  });
  assert.equal(result.kind, 'network');
  assert.equal(sawAbort, true);
});

for (const status of [429, 503]) {
  test(`receipt HTTP ${status} leaves queued operation pending without invalid-receipt copy`, async () => {
    const op = queuedOp();
    const next = await reconcileOpsWithHistoricalReceipts({
      ops: [op],
      queueItems: [queueRow('pending')],
      bearer: 'tok',
      apiBase: 'https://api.example',
      shouldContinue: () => true,
      fetchImpl: async () => new Response(JSON.stringify({ code: 'TEMPORARY' }), { status }),
    });
    assert.equal(next[0], op);
    assert.equal(next[0]?.phase, 'queued');
    assert.doesNotMatch(next[0]?.message ?? '', /biên nhận không hợp lệ/);
  });
}

test('opNeedsHistoricalReceiptLookup respects terminal queue rows', () => {
  const op = queuedOp();
  const byId = new Map([[clientEventId, queueRow('applied')]]);
  assert.equal(opNeedsHistoricalReceiptLookup(op, byId), false);
  assert.equal(opNeedsHistoricalReceiptLookup(op, new Map()), true);
  assert.equal(
    opNeedsHistoricalReceiptLookup(op, new Map([[clientEventId, queueRow('pending')]])),
    true,
  );
});

test('fetchOfflineSyncReceipt maps auth errors', async () => {
  const forbidden = await fetchOfflineSyncReceipt({
    bearer: 'tok',
    apiBase: 'https://api.example',
    tenantId,
    eventId,
    clientEventId,
    fetchImpl: async () => new Response('', { status: 403 }),
  });
  assert.equal(forbidden.kind, 'auth');
});

for (const status of [401, 403] as const) {
  test(`background receipt ${status} signals eligibility reset and keeps queue non-admitted`, async () => {
    let denied: number | null = null;
    const next = await reconcileOpsWithHistoricalReceipts({
      ops: [queuedOp()], queueItems: [], bearer: 'tok', apiBase: 'https://api.example',
      shouldContinue: () => true,
      onAuthzDenied: (code) => { denied = code; },
      fetchImpl: async () => new Response('', { status }),
    });
    assert.equal(denied, status);
    assert.equal(next[0]?.phase, 'queued');
  });
}
