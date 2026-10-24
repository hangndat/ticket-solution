import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import { presentGateOutcome } from './gate-outcome-copy.ts';
import { classifySupervisorOp } from './gate-scan.ts';
import {
  applyKnownOperationImportToOps,
  findScopedGateOpByClientEventId,
  gateOpFromOrphanHistoricalReceipt,
  importKnownOperationFromReceipt,
  isRecordedKnownImportNoop,
  parseKnownClientEventIdInput,
} from './gate-known-op-recovery.ts';
import type { ParsedOfflineSyncReceipt } from './offline-sync-receipt.ts';

const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const ticketId = '11111111-1111-4111-8111-111111111111';
const staffSessionId = '44444444-4444-4444-8444-444444444444';
const clientEventId = '6c812d24-2d8e-44eb-b55d-23c358e75f09';
const checkinId = '46a428ee-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const receipt: ParsedOfflineSyncReceipt = {
  tenantId,
  eventId,
  clientEventId,
  status: 'APPLIED',
  historical: true,
  ticketId,
  checkinId,
  staffSessionId,
  appliedAt: '2026-10-23T12:00:00.000Z',
  checkinState: 'CURRENT',
};

const scope = { tenantId, eventId, name: 'FixAll' };

function baseCtx(overrides: Partial<Parameters<typeof importKnownOperationFromReceipt>[1]> = {}) {
  return {
    scope,
    sessionId: 'sess-1',
    verifiedUserId: 'user-1',
    ops: [] as GateOp[],
    bearer: 'tok',
    apiBase: 'https://api.example',
    shouldContinue: () => true,
    ...overrides,
  };
}

test('parseKnownClientEventIdInput accepts UUID and rejects junk', () => {
  assert.equal(parseKnownClientEventIdInput(clientEventId), clientEventId);
  assert.equal(parseKnownClientEventIdInput(clientEventId.toUpperCase()), clientEventId);
  assert.equal(parseKnownClientEventIdInput('not-a-uuid'), null);
  assert.equal(parseKnownClientEventIdInput(''), null);
});

test('uppercase operation imports one canonical recorded row', async () => {
  const outcome = await importKnownOperationFromReceipt(clientEventId.toUpperCase(), baseCtx({
    fetchImpl: async (url) => {
      assert.match(String(url), new RegExp(clientEventId));
      return new Response(JSON.stringify(receipt), { status: 200 });
    },
  }));
  assert.equal(outcome.kind, 'imported');
  if (outcome.kind === 'imported') {
    const rows = applyKnownOperationImportToOps([], undefined, outcome.op);
    const again = applyKnownOperationImportToOps(rows, rows[0], outcome.op);
    assert.equal(again.length, 1);
    assert.equal(again[0]?.clientEventId, clientEventId);
  }
});

test('stale before request prevents GET, including recorded noop', async () => {
  let gets = 0;
  const fetchImpl = async () => { gets += 1; return new Response('', { status: 500 }); };
  for (const ops of [[], [gateOpFromOrphanHistoricalReceipt(receipt)]]) {
    const outcome = await importKnownOperationFromReceipt(clientEventId, baseCtx({
      ops, shouldContinue: () => false, fetchImpl,
    }));
    assert.equal(outcome.kind, 'error');
    if (outcome.kind === 'error') assert.equal(outcome.code, 'stale');
  }
  assert.equal(gets, 0);
});

for (const status of [401, 403] as const) {
  test(`known operation receipt ${status} signals eligibility reset`, async () => {
    let denied: number | null = null;
    const outcome = await importKnownOperationFromReceipt(clientEventId, baseCtx({
      onAuthzDenied: (code) => { denied = code; },
      fetchImpl: async () => new Response('', { status }),
    }));
    assert.equal(outcome.kind, 'error');
    assert.equal(denied, status);
  });
}

test('orphan import creates neutral recorded op', () => {
  const op = gateOpFromOrphanHistoricalReceipt(receipt);
  assert.equal(op.phase, 'recorded');
  assert.equal(op.checkinId, checkinId);
  assert.equal(classifySupervisorOp(op), 'not-admission');
  assert.equal(presentGateOutcome(op).tone, 'unknown');
  assert.match(op.message, /Đã ghi nhận trước đó/);
});

test('import with no local op fetches and returns imported', async () => {
  const outcome = await importKnownOperationFromReceipt(
    clientEventId,
    baseCtx({
      fetchImpl: async () =>
        new Response(JSON.stringify(receipt), { status: 200 }),
    }),
  );
  assert.equal(outcome.kind, 'imported');
  if (outcome.kind === 'imported') {
    assert.equal(outcome.op.phase, 'recorded');
    assert.equal(outcome.op.clientEventId, clientEventId);
  }
});

test('duplicate import on recorded op is noop', async () => {
  const recorded = gateOpFromOrphanHistoricalReceipt(receipt);
  const outcome = await importKnownOperationFromReceipt(
    clientEventId,
    baseCtx({
      ops: [recorded],
      fetchImpl: async () => new Response('', { status: 500 }),
    }),
  );
  assert.equal(outcome.kind, 'noop');
});

test('stale guard after await discards import', async () => {
  let allow = true;
  const outcome = await importKnownOperationFromReceipt(
    clientEventId,
    baseCtx({
      shouldContinue: () => allow,
      fetchImpl: async () => {
        allow = false;
        return new Response(JSON.stringify(receipt), { status: 200 });
      },
    }),
  );
  assert.equal(outcome.kind, 'error');
  if (outcome.kind === 'error') assert.equal(outcome.code, 'stale');
});

test('wrong id and malformed responses do not import', async () => {
  const badId = await importKnownOperationFromReceipt('legacy', baseCtx());
  assert.equal(badId.kind, 'error');

  const notFound = await importKnownOperationFromReceipt(
    clientEventId,
    baseCtx({
      fetchImpl: async () => new Response('', { status: 404 }),
    }),
  );
  assert.equal(notFound.kind, 'error');
  if (notFound.kind === 'error') assert.equal(notFound.code, 'not_found');

  const mismatch = await importKnownOperationFromReceipt(
    clientEventId,
    baseCtx({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ...receipt,
            clientEventId: '00000000-0000-4000-8000-000000000001',
          }),
          { status: 200 },
        ),
    }),
  );
  assert.equal(mismatch.kind, 'error');
  if (mismatch.kind === 'error') assert.equal(mismatch.code, 'malformed');
});

test('merge replaces existing queued op by clientEventId', () => {
  const queued: GateOp = {
    id: clientEventId,
    ticketId,
    tenantId,
    eventId,
    staffSessionId,
    clientEventId,
    phase: 'queued',
    message: 'q',
  };
  const recorded = gateOpFromOrphanHistoricalReceipt(receipt);
  const next = applyKnownOperationImportToOps([queued], queued, recorded);
  assert.equal(next.length, 1);
  assert.equal(next[0]?.phase, 'recorded');
  assert.equal(findScopedGateOpByClientEventId(next, scope, clientEventId)?.checkinId, checkinId);
});

test('isRecordedKnownImportNoop matches checkin id', () => {
  const recorded = gateOpFromOrphanHistoricalReceipt(receipt);
  assert.equal(isRecordedKnownImportNoop(recorded, recorded), true);
});
