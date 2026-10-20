import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import { presentGateScanStatus, stampGateOpsRecordedAt } from './gate-scan-status-ui.ts';

const baseOp: GateOp = {
  id: 'op-1',
  ticketId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenantId: '11111111-2222-3333-4444-555555555555',
  eventId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  staffSessionId: 'sess',
  phase: 'admitted',
  checkinId: 'chk-1',
  message: 'Cho vào.',
  admissionKind: 'fresh',
};

test('presentGateScanStatus processing avoids admit check when busy', () => {
  const view = presentGateScanStatus({
    busy: true,
    op: baseOp,
    canReconcile: false,
  });
  assert.equal(view.kind, 'processing');
  assert.notEqual(view.symbol, 'checkmark.circle.fill');
});

test('presentGateScanStatus filled check only for fresh admission', () => {
  const view = presentGateScanStatus({
    busy: false,
    op: baseOp,
    canReconcile: false,
  });
  assert.equal(view.kind, 'admitted');
  assert.equal(view.symbol, 'checkmark.circle.fill');
});

test('presentGateScanStatus outline check for already-used ticket', () => {
  const view = presentGateScanStatus({
    busy: false,
    op: {
      ...baseOp,
      admissionKind: 'already',
      message: 'Đã check-in trước.',
    },
    canReconcile: false,
  });
  assert.equal(view.kind, 'already-checked-in');
  assert.equal(view.symbol, 'checkmark.circle');
});

test('presentGateScanStatus confirming is not admitted', () => {
  const view = presentGateScanStatus({
    busy: false,
    op: { ...baseOp, phase: 'confirming', checkinId: undefined },
    canReconcile: false,
  });
  assert.equal(view.kind, 'confirming');
  assert.equal(view.symbol, 'hourglass.circle.fill');
});

test('stampGateOpsRecordedAt preserves time when unchanged', () => {
  const prev: GateOp[] = [
    { ...baseOp, recordedAt: '2026-01-01T00:00:00.000Z' },
  ];
  const next = stampGateOpsRecordedAt(prev, prev, () => '2026-02-01T00:00:00.000Z');
  assert.equal(next[0].recordedAt, '2026-01-01T00:00:00.000Z');
});

test('stampGateOpsRecordedAt updates when phase changes', () => {
  const prev: GateOp[] = [
    {
      ...baseOp,
      phase: 'confirming',
      recordedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const next = stampGateOpsRecordedAt([baseOp], prev, () => '2026-02-01T00:00:00.000Z');
  assert.equal(next[0].recordedAt, '2026-02-01T00:00:00.000Z');
});
