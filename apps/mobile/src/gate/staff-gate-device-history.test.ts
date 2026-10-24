import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { OFFLINE_SYNC_PAYLOAD_VERSION } from './offline-sync-contract.ts';
import {
  buildDeviceScanHistory,
  computeDeviceHistoryPageView,
  DEVICE_HISTORY_PAGE_SIZE,
  filterLoadedDeviceHistoryRows,
  groupDeviceHistoryByDay,
} from './staff-gate-device-history.ts';

const scope: StaffGateScope = {
  tenantId: '11111111-2222-3333-4444-555555555555',
  eventId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  name: 'Demo',
};

function makeOp(id: string, recordedAt: string): GateOp {
  return {
    id,
    ticketId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    tenantId: scope.tenantId,
    eventId: scope.eventId,
    staffSessionId: 's',
    phase: 'admitted',
    checkinId: 'c',
    message: 'ok',
    recordedAt,
  };
}

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
  const older = makeOp('old', '2026-10-19T09:00:00.000Z');
  const newer = makeOp('new', '2026-10-19T12:00:00.000Z');
  const rows = buildDeviceScanHistory(scope, [older, newer], []);
  assert.equal(rows[0].id, 'new');
});

test('buildDeviceScanHistory returns all rows without hard cap', () => {
  const ops = Array.from({ length: 20 }, (_, i) =>
    makeOp(`op-${i}`, `2026-10-19T${String(10 + i).padStart(2, '0')}:00:00.000Z`),
  );
  const rows = buildDeviceScanHistory(scope, ops, []);
  assert.equal(rows.length, 20);
});

test('computeDeviceHistoryPageView paginates and reports hasMore', () => {
  const all = Array.from({ length: 15 }, (_, i) => ({
    id: String(i),
    at: `2026-10-19T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
    ticketLabel: `ticket-${i}`,
    statusLabel: 'Vào',
    hint: '',
    tone: 'admit' as const,
    source: 'scan' as const,
  }));
  const withMeta = all.map((row) => ({
    ...row,
    operationLabel: 'op-…',
    receiptLabel: '—',
  }));
  const first = computeDeviceHistoryPageView(
    withMeta,
    DEVICE_HISTORY_PAGE_SIZE,
    '',
  );
  assert.equal(first.loadedCount, DEVICE_HISTORY_PAGE_SIZE);
  assert.equal(first.rows.length, DEVICE_HISTORY_PAGE_SIZE);
  assert.equal(first.totalAvailable, 15);
  assert.equal(first.hasMore, true);

  const full = computeDeviceHistoryPageView(withMeta, 30, '');
  assert.equal(full.hasMore, false);
  assert.equal(full.rows.length, 15);
});

test('filterLoadedDeviceHistoryRows matches ticket or status labels', () => {
  const rows = [
    {
      id: '1',
      at: '2026-10-19T10:00:00.000Z',
      ticketLabel: 'abcd-1234',
      operationLabel: 'ce-1',
      receiptLabel: '—',
      statusLabel: 'Từ chối',
      hint: '',
      tone: 'deny' as const,
      source: 'scan' as const,
    },
    {
      id: '2',
      at: '2026-10-19T11:00:00.000Z',
      ticketLabel: 'wxyz-5678',
      operationLabel: 'ce-2',
      receiptLabel: '—',
      statusLabel: 'Cho vào',
      hint: '',
      tone: 'admit' as const,
      source: 'scan' as const,
    },
  ];
  assert.equal(filterLoadedDeviceHistoryRows(rows, 'abcd').length, 1);
  assert.equal(filterLoadedDeviceHistoryRows(rows, 'cho vào').length, 1);
  assert.equal(filterLoadedDeviceHistoryRows(rows, '').length, 2);
});

test('groupDeviceHistoryByDay adds Hôm nay header for same calendar day', () => {
  const now = new Date('2026-10-24T15:00:00.000Z');
  const rows = [
    {
      id: '1',
      at: '2026-10-24T10:00:00.000Z',
      ticketLabel: 'a',
      operationLabel: 'ce-a',
      receiptLabel: '—',
      statusLabel: 'Vào',
      hint: '',
      tone: 'admit' as const,
      source: 'scan' as const,
    },
    {
      id: '2',
      at: '2026-10-23T10:00:00.000Z',
      ticketLabel: 'b',
      operationLabel: 'ce-b',
      receiptLabel: '—',
      statusLabel: 'Vào',
      hint: '',
      tone: 'admit' as const,
      source: 'scan' as const,
    },
  ];
  const sections = groupDeviceHistoryByDay(rows, now);
  assert.equal(sections.length, 2);
  assert.match(sections[0].headerLabel, /Hôm nay/);
  assert.equal(sections[0].rows.length, 1);
});
