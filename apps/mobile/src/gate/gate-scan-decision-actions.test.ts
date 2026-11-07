import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanDecisionActions } from './gate-scan-decision-actions.ts';
import type { GateOp } from './gate-scan.ts';
import type { OfflineQueueSnapshot } from './offline-queue.ts';

const base: GateOp = {
  id: 'op',
  ticketId: 'ticket',
  tenantId: 'tenant',
  eventId: 'event',
  staffSessionId: 'session',
  phase: 'unknown',
  message: 'Không cho vào.',
};
const queue: OfflineQueueSnapshot = {
  items: [],
  pendingCount: 0,
  conflictCount: 0,
  syncing: false,
  lastSyncError: null,
};

test('reserve 503 has no unsafe reconciliation action', () => {
  assert.deepEqual(
    scanDecisionActions({
      op: base,
      queue,
      connectivity: 'online',
      busy: false,
    }),
    { reconcile: false, sync: false, continueScan: true },
  );
  assert.equal(
    scanDecisionActions({
      op: { ...base, reservationId: 'hold', token: 'secret' },
      queue,
      connectivity: 'online',
      busy: false,
    }).reconcile,
    true,
  );
});

test('queued sync requires the matching pending item, online state, and idle replay owner', () => {
  const op = {
    ...base,
    phase: 'queued' as const,
    clientEventId: 'client-event',
  };
  const item = {
    clientEventId: 'client-event',
    type: 'CHECKIN_OFFLINE' as const,
    ticketId: 'ticket',
    tenantId: 'tenant',
    eventId: 'event',
    staffSessionId: 'session',
    clientOccurredAt: '2026-11-08T00:00:00Z',
    clientSeq: 1,
    payloadVersion: 1 as const,
    localStatus: 'pending' as const,
  };
  const snapshot = { ...queue, items: [item], pendingCount: 1 };
  assert.equal(
    scanDecisionActions({
      op,
      queue: snapshot,
      connectivity: 'online',
      busy: false,
    }).sync,
    true,
  );
  assert.equal(
    scanDecisionActions({
      op,
      queue: snapshot,
      connectivity: 'offline',
      busy: false,
    }).sync,
    false,
  );
  assert.equal(
    scanDecisionActions({
      op,
      queue: { ...snapshot, syncing: true },
      connectivity: 'online',
      busy: false,
    }).sync,
    false,
  );
  assert.equal(
    scanDecisionActions({
      op,
      queue: { ...snapshot, items: [{ ...item, eventId: 'other' }] },
      connectivity: 'online',
      busy: false,
    }).sync,
    false,
  );
  assert.equal(
    scanDecisionActions({
      op,
      queue: snapshot,
      connectivity: 'online',
      busy: true,
    }).continueScan,
    false,
  );
});
