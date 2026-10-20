import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { OFFLINE_SYNC_PAYLOAD_VERSION } from './offline-sync-contract.ts';
import { buildDeviceScanHistory } from './staff-gate-device-history.ts';

const scope: StaffGateScope = {
  tenantId: '11111111-2222-3333-4444-555555555555',
  eventId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  name: 'Demo',
};

test('buildDeviceScanHistory scopes ops to tenant/event', () => {
  const op: GateOp = {
    id: '1',
    ticketId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    tenantId: scope.tenantId,
    eventId: scope.eventId,
    staffSessionId: 's',
    phase: 'denied',
    message: 'Từ chối',
    recordedAt: '2026-10-19T10:00:00.000Z',
  };
  const other: GateOp = {
    ...op,
    id: '2',
    eventId: '00000000-0000-0000-0000-000000000099',
  };
  const rows = buildDeviceScanHistory(scope, [op, other], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, '1');
});

test('buildDeviceScanHistory merges queue rows', () => {
  const queue: QueuedOfflineScan = {
    clientEventId: 'q-1',
    type: 'CHECKIN_OFFLINE',
    eventId: scope.eventId,
    ticketId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
    tenantId: scope.tenantId,
    staffSessionId: 's',
    clientOccurredAt: '2026-10-19T11:00:00.000Z',
    clientSeq: 0,
    payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
    localStatus: 'pending',
  };
  const rows = buildDeviceScanHistory(scope, [], [queue]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'offline-queue');
  assert.match(rows[0].statusLabel, /đồng bộ/i);
});

test('buildDeviceScanHistory sorts newest first', () => {
  const older: GateOp = {
    id: 'old',
    ticketId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    tenantId: scope.tenantId,
    eventId: scope.eventId,
    staffSessionId: 's',
    phase: 'admitted',
    checkinId: 'c',
    message: 'ok',
    recordedAt: '2026-10-19T09:00:00.000Z',
  };
  const newer: GateOp = {
    ...older,
    id: 'new',
    recordedAt: '2026-10-19T12:00:00.000Z',
  };
  const rows = buildDeviceScanHistory(scope, [older, newer], []);
  assert.equal(rows[0].id, 'new');
});
