import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import {
  TERMINAL_SCAN_FLASH_MS,
  cameraFeedbackLifecycle,
  classifyScanFeedbackLifecycle,
  shouldDismissToastAttempt,
  shouldSuppressCameraRescan,
} from './staff-gate-scan-feedback.ts';

const admitted: GateOp = {
  id: 'a1',
  ticketId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenantId: '11111111-2222-3333-4444-555555555555',
  eventId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  staffSessionId: 's',
  phase: 'admitted',
  checkinId: 'c',
  message: 'ok',
  admissionKind: 'fresh',
};

test('classifyScanFeedbackLifecycle terminal only for admitted', () => {
  assert.equal(
    classifyScanFeedbackLifecycle(admitted, false),
    'terminal-flash',
  );
  assert.equal(
    classifyScanFeedbackLifecycle({ ...admitted, phase: 'queued' }, false),
    'sticky',
  );
  assert.equal(
    classifyScanFeedbackLifecycle({ ...admitted, phase: 'confirming' }, false),
    'sticky',
  );
  assert.equal(classifyScanFeedbackLifecycle(null, true), 'processing');
  assert.equal(classifyScanFeedbackLifecycle(null, false), 'idle');
});

test('toast timer clears only matching attempt id', () => {
  assert.equal(shouldDismissToastAttempt('t1', 't1'), true);
  assert.equal(shouldDismissToastAttempt('t1', 't2'), false);
  assert.equal(shouldDismissToastAttempt('t1', null), false);
});

test('cameraFeedbackLifecycle uses toast visibility', () => {
  assert.equal(cameraFeedbackLifecycle(false, true, null), 'terminal-flash');
  assert.equal(cameraFeedbackLifecycle(false, false, admitted), 'sticky');
  assert.equal(cameraFeedbackLifecycle(false, false, null), 'idle');
});

test('camera dedupe suppresses same QR only while feedback active', () => {
  const payload = 'same-qr';
  assert.equal(
    shouldSuppressCameraRescan(payload, payload, 'terminal-flash'),
    true,
  );
  assert.equal(shouldSuppressCameraRescan(payload, payload, 'idle'), false);
  assert.equal(
    shouldSuppressCameraRescan('other', payload, 'terminal-flash'),
    false,
  );
});

test('TERMINAL_SCAN_FLASH_MS in 2–3s range', () => {
  assert.ok(TERMINAL_SCAN_FLASH_MS >= 2000);
  assert.ok(TERMINAL_SCAN_FLASH_MS <= 3000);
});
