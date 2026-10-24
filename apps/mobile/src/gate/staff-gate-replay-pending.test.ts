import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import {
  findTerminalReplayFeedbackOp,
  resolvePendingOpAfterOfflineReplay,
} from './staff-gate-replay-pending.ts';

const sessionId = '44444444-4444-4444-8444-444444444444';

function queuedOp(id: string, clientEventId: string): GateOp {
  return {
    id,
    ticketId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    staffSessionId: sessionId,
    clientEventId,
    phase: 'queued',
    message: 'Offline',
    recordedAt: '2026-10-24T10:00:00.000Z',
  };
}

test('resolvePendingOpAfterOfflineReplay clears admitted terminal pending', () => {
  const current = queuedOp('op-1', 'ce-1');
  const next = { ...current, phase: 'admitted' as const, checkinId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const pending = resolvePendingOpAfterOfflineReplay({
    currentPending: current,
    currentOps: [current],
    nextOps: [next],
    activeSession: sessionId,
  });
  assert.equal(pending, null);
});

test('resolvePendingOpAfterOfflineReplay keeps sticky unknown pending', () => {
  const current = queuedOp('op-1', 'ce-1');
  const next = { ...current, phase: 'unknown' as const, message: 'cần đối soát' };
  const pending = resolvePendingOpAfterOfflineReplay({
    currentPending: current,
    currentOps: [current],
    nextOps: [next],
    activeSession: sessionId,
  });
  assert.equal(pending?.phase, 'unknown');
});

test('resolvePendingOpAfterOfflineReplay clears recorded terminal pending', () => {
  const current = queuedOp('op-1', 'ce-1');
  const next = {
    ...current,
    phase: 'recorded' as const,
    checkinId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    message: 'Đã ghi nhận trước đó',
  };
  const pending = resolvePendingOpAfterOfflineReplay({
    currentPending: current,
    currentOps: [current],
    nextOps: [next],
    activeSession: sessionId,
  });
  assert.equal(pending, null);
});

test('findTerminalReplayFeedbackOp detects queued to admitted transition', () => {
  const before = queuedOp('op-1', 'ce-1');
  const after = { ...before, phase: 'admitted' as const, checkinId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const feedback = findTerminalReplayFeedbackOp([before], [after]);
  assert.equal(feedback?.phase, 'admitted');
  assert.equal(findTerminalReplayFeedbackOp([before], [before]), undefined);
});
