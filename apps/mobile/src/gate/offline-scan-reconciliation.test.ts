import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateOpFromQueued } from './gate-scan.ts';
import type { GateOp } from './gate-scan.ts';
import { buildDeviceScanHistory } from './staff-gate-device-history.ts';
import { OfflineScanQueue } from './offline-queue.ts';
import { createMemoryOfflineQueueStore } from './offline-queue-types.ts';
import { canApplyOfflineReplay, rebaseOfflineReplayOps, reconcileOfflineScanOps } from './offline-scan-reconciliation.ts';
import { reconcileOpsWithHistoricalReceipts } from './offline-sync-receipt.ts';
import { applyKnownOperationImportToOps, importKnownOperationFromReceipt } from './gate-known-op-recovery.ts';
import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import { emptyStaffGateWorkspace, persistActiveScope, sliceWorkspaceForScope } from './staff-gate-workspace.ts';

const scope = { tenantId: '22222222-2222-4222-8222-222222222222', eventId: '33333333-3333-4333-8333-333333333333', name: 'MFest' };
const ticketId = '11111111-1111-4111-8111-111111111111';
const staffSessionId = '44444444-4444-4444-8444-444444444444';
const checkinId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function setup() {
  const store = createMemoryOfflineQueueStore([], 'staff');
  const queue = new OfflineScanQueue(store, {
    createId: (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; })(),
    nowIso: () => '2026-10-23T15:00:00.000Z',
  });
  await queue.bindUser('staff');
  const row = await queue.enqueue({ ticketId, tenantId: scope.tenantId, eventId: scope.eventId, staffSessionId });
  const op = { ...gateOpFromQueued({ id: row.clientEventId, ticketId, tenantId: scope.tenantId, eventId: scope.eventId, staffSessionId, clientEventId: row.clientEventId }), recordedAt: row.clientOccurredAt };
  return { queue, row, op, store };
}

for (const status of ['APPLIED', 'DUPLICATE', 'REJECTED', 'CONFLICT'] as const) {
  test(`replay ${status} reconciles persisted ops, panel and History`, async () => {
    const { queue, row, op, store } = await setup();
    const result = await queue.replay({
      bearer: 'synthetic', apiBase: 'https://api.example',
      fetchImpl: async () => new Response(JSON.stringify({ serverTime: '2026-10-23T15:00:01.000Z', maxClockSkewSeconds: 300, results: [{ clientEventId: row.clientEventId, status, checkinId: status === 'APPLIED' || status === 'DUPLICATE' ? checkinId : undefined, code: status === 'CONFLICT' ? 'OFFLINE_SYNC_CONFLICT_LOST' : undefined }] }), { status: 200 }),
    });
    assert.equal(result.results[0]?.status, status);
    assert.equal(queue.getSnapshot().pendingCount, 0);
    const next = reconcileOfflineScanOps([op], queue.getSnapshot().items);
    const persisted = persistActiveScope(emptyStaffGateWorkspace(), scope, next, staffSessionId);
    const restored = sliceWorkspaceForScope(persisted, scope).ops[0]!;
    const panel = presentGateScanStatus({ busy: false, op: restored, canReconcile: false });
    const history = buildDeviceScanHistory(scope, [restored], queue.getSnapshot().items);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.source, 'scan');
    if (status === 'APPLIED' || status === 'DUPLICATE') {
      assert.equal(restored.checkinId, checkinId);
      assert.equal(restored.phase, 'admitted');
      assert.equal(panel.kind, status === 'APPLIED' ? 'admitted' : 'already-checked-in');
    } else {
      assert.equal(restored.phase, 'denied');
      assert.equal(panel.kind, 'denied');
    }
    const hydrated = new OfflineScanQueue(store);
    await hydrated.bindUser('staff');
    assert.equal(hydrated.getSnapshot().items[0]?.localStatus, status.toLowerCase());
  });
}

test('missing result, network error and missing checkin never admit', async () => {
  for (const mode of ['missing', 'network', 'no-checkin'] as const) {
    const { queue, op } = await setup();
    await queue.replay({ bearer: 'synthetic', apiBase: 'https://api.example', fetchImpl: async () => {
      if (mode === 'network') throw new Error('offline');
      return new Response(JSON.stringify({ results: mode === 'missing' ? [] : [{ clientEventId: op.clientEventId, status: 'APPLIED' }] }), { status: 200 });
    } });
    const next = reconcileOfflineScanOps([op], queue.getSnapshot().items)[0]!;
    assert.notEqual(next.phase, 'admitted');
    assert.equal(next.checkinId, undefined);
  }
});

test('lost or mismatched receipt becomes unknown, never inherits another operation', async () => {
  const { queue, row, op } = await setup();
  const altered = [
    { ...op, staffSessionId: 'new-session' },
    { ...op, tenantId: 'other' },
    { ...op, eventId: 'other' },
    { ...op, ticketId: 'other' },
    { ...op, clientEventId: 'new-operation' },
  ];
  const terminal = { ...row, localStatus: 'applied' as const, checkinId };
  for (const candidate of altered) {
    const reconciled = reconcileOfflineScanOps([candidate], [terminal])[0]!;
    assert.equal(reconciled.phase, 'unknown');
    assert.equal(reconciled.checkinId, undefined);
  }
  assert.equal(reconcileOfflineScanOps([op], [],)[0]?.phase, 'unknown');
  const newerScan = { ...op, phase: 'denied' as const };
  assert.equal(reconcileOfflineScanOps([newerScan], [terminal])[0], newerScan);
});

test('late replay cannot update another verified user, scope, session or newer scan', () => {
  const valid = {
    replayUserId: 'staff', verifiedUserId: 'staff', queueOwnerUserId: 'staff',
    startedGeneration: 3, currentGeneration: 3,
    startedScope: scope, currentScope: scope,
    startedSessionId: staffSessionId, currentSessionId: staffSessionId,
  };
  assert.equal(canApplyOfflineReplay(valid), true);
  for (const invalid of [
    { verifiedUserId: 'other' }, { queueOwnerUserId: 'other' },
    { currentGeneration: 4 }, { currentScope: { ...scope, tenantId: 'other' } },
    { currentScope: { ...scope, eventId: 'other' } },
    { currentSessionId: 'other' }, { currentScope: null },
  ]) assert.equal(canApplyOfflineReplay({ ...valid, ...invalid }), false);
});

for (const order of ['import-first', 'replay-first'] as const) {
  test(`deferred replay and known import retain both receipts after reload: ${order}`, async () => {
    const { op: x } = await setup();
    const yId = '6c812d24-2d8e-44eb-b55d-23c358e75f09';
    const yTicket = '55555555-5555-4555-8555-555555555555';
    const receipt = (id: string, ticket: string) => ({
      tenantId: scope.tenantId, eventId: scope.eventId, clientEventId: id,
      status: 'APPLIED', historical: true, ticketId: ticket,
      checkinId: id === yId ? '66666666-6666-4666-8666-666666666666' : checkinId,
      staffSessionId, appliedAt: '2026-10-23T15:00:01.000Z', checkinState: 'CURRENT',
    });
    let releaseX!: () => void;
    let releaseY!: () => void;
    const waitX = new Promise<void>((resolve) => { releaseX = resolve; });
    const waitY = new Promise<void>((resolve) => { releaseY = resolve; });
    let latest: GateOp[] = [x];
    const started = latest;
    const replay = reconcileOpsWithHistoricalReceipts({
      ops: started, queueItems: [], bearer: 'tok', apiBase: 'https://api.example',
      shouldContinue: () => true,
      fetchImpl: async () => { await waitX; return new Response(JSON.stringify(receipt(x.clientEventId!, ticketId)), { status: 200 }); },
    }).then((next) => { latest = rebaseOfflineReplayOps(started, next, latest); });
    const imported = importKnownOperationFromReceipt(yId, {
      scope, sessionId: staffSessionId, verifiedUserId: 'staff', ops: [],
      bearer: 'tok', apiBase: 'https://api.example', shouldContinue: () => true,
      fetchImpl: async () => { await waitY; return new Response(JSON.stringify(receipt(yId, yTicket)), { status: 200 }); },
    }).then((outcome) => {
      assert.equal(outcome.kind, 'imported');
      if (outcome.kind === 'imported') latest = applyKnownOperationImportToOps(latest, undefined, outcome.op);
    });
    if (order === 'import-first') { releaseY(); await imported; releaseX(); await replay; }
    else { releaseX(); await replay; releaseY(); await imported; }
    const durable = JSON.parse(JSON.stringify(persistActiveScope(emptyStaffGateWorkspace(), scope, latest, staffSessionId)));
    const restored = sliceWorkspaceForScope(durable, scope).ops;
    assert.equal(restored.length, 2);
    assert.equal(restored.find((op) => op.clientEventId === x.clientEventId)?.phase, 'recorded');
    assert.equal(restored.find((op) => op.clientEventId === yId)?.phase, 'recorded');
  });
}
