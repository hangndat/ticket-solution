import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  announcementPhaseFor,
  presentGateOutcome,
  presentQueueStatus,
} from './gate-outcome-copy.ts';
import type { GateOp } from './gate-scan.ts';

const base: GateOp = {
  id: 'op-1',
  ticketId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  staffSessionId: '44444444-4444-4444-8444-444444444444',
  phase: 'denied',
  message: '',
};

test('queued and unknown never use admit tone', () => {
  const queued = presentGateOutcome({
    ...base,
    phase: 'queued',
    message: 'Đã xếp hàng offline.',
  });
  assert.equal(queued.kind, 'queued');
  assert.equal(queued.tone, 'unknown');
  assert.equal(queued.assertive, true);
  assert.notEqual(queued.title, 'Cho vào');
  assert.match(queued.title, /Chưa xác nhận vào cổng/i);

  const unknown = presentGateOutcome({
    ...base,
    phase: 'unknown',
    message: 'Kết quả chưa rõ.',
  });
  assert.equal(unknown.tone, 'unknown');
  assert.equal(unknown.assertive, true);
  assert.match(unknown.title, /không cho vào/i);
});

test('fresh admission is green while already-checked-in history is denied', () => {
  const fresh = presentGateOutcome({
    ...base,
    phase: 'admitted',
    admissionKind: 'fresh',
    checkinId: 'c1',
    message: 'Cho vào. Đã ghi nhận check-in.',
  });
  assert.equal(fresh.kind, 'admitted');
  assert.equal(fresh.tone, 'admit');
  assert.equal(fresh.title, 'Được vào');

  const already = presentGateOutcome({
    ...base,
    phase: 'admitted',
    admissionKind: 'already',
    checkinId: 'c1',
    message: 'Đã check-in. Kết quả đã rõ.',
  });
  assert.equal(already.kind, 'already-checked-in');
  assert.equal(already.tone, 'deny');
  assert.equal(already.assertive, true);
  assert.match(already.title, /đã được sử dụng/i);
  assert.match(already.detail, /không cho vào/i);
  assert.notEqual(already.title, fresh.title);
});

test('queue DUPLICATE and CONFLICT are not admit green', () => {
  const dup = presentQueueStatus('duplicate');
  assert.equal(dup.serverToken, 'DUPLICATE');
  assert.equal(dup.tone, 'unknown');
  assert.match(dup.detail, /không phải lượt vào mới/i);

  const conflict = presentQueueStatus('conflict');
  assert.equal(conflict.serverToken, 'CONFLICT');
  assert.equal(conflict.tone, 'unknown');

  const applied = presentQueueStatus('applied');
  assert.equal(applied.serverToken, 'APPLIED');
  assert.equal(applied.tone, 'admit');

  const rejected = presentQueueStatus('rejected');
  assert.equal(rejected.serverToken, 'REJECTED');
  assert.equal(rejected.tone, 'deny');
});

test('announcement maps queued to unknown', () => {
  assert.equal(announcementPhaseFor('queued'), 'unknown');
  assert.equal(announcementPhaseFor('admitted'), 'admitted');
});
