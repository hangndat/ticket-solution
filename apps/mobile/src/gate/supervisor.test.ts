import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyConfirm,
  classifySupervisorOp,
  listUnknownGateOps,
  type GateOp,
} from './gate-scan.ts';

const holding: GateOp = {
  id: 'op-1',
  ticketId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  staffSessionId: '44444444-4444-4444-8444-444444444444',
  reservationId: '55555555-5555-4555-8555-555555555555',
  token: 'confirm-token',
  phase: 'confirming',
  message: 'Confirming',
};

test('unknown is not an admission', () => {
  const unknown: GateOp = {
    ...holding,
    phase: 'unknown',
    message: 'Result unknown. Do not admit.',
  };
  assert.equal(classifySupervisorOp(unknown), 'not-admission');
  assert.notEqual(classifySupervisorOp(unknown), 'admission');
  const listed = listUnknownGateOps([
    unknown,
    { ...holding, id: 'op-ok', phase: 'admitted', checkinId: 'check-1' },
    { ...holding, id: 'op-no', phase: 'denied' },
  ]);
  assert.deepEqual(
    listed.map((op) => op.id),
    ['op-1'],
  );
  assert.ok(listed.every((op) => classifySupervisorOp(op) === 'not-admission'));
});

test('timeout and 5xx never admit', () => {
  const timeout = applyConfirm(holding, {
    status: 0,
    json: null,
    networkError: true,
  });
  assert.equal(timeout.phase, 'unknown');
  assert.equal(classifySupervisorOp(timeout), 'not-admission');

  for (const status of [500, 502, 503]) {
    const failed = applyConfirm(holding, {
      status,
      json: { message: 'unavailable' },
      networkError: false,
    });
    assert.equal(failed.phase, 'unknown');
    assert.equal(classifySupervisorOp(failed), 'not-admission');
  }

  const admitted = applyConfirm(holding, {
    status: 200,
    json: { state: 'USED', checkinId: '66666666-6666-4666-8666-666666666666' },
    networkError: false,
  });
  assert.equal(classifySupervisorOp(admitted), 'admission');
});
