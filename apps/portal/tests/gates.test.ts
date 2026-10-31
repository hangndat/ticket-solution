import assert from 'node:assert/strict';
import test from 'node:test';
import {
  interpretGateCreate,
  parseGateForm,
  parseGateList,
} from '../src/gates/gates';
import { PORTAL_UPSTREAM } from '../src/bff/paths';

test('parseGateForm validates name and sort order', () => {
  assert.deepEqual(parseGateForm('  Cổng A ', ''), {
    ok: true,
    value: { name: 'Cổng A' },
  });
  assert.deepEqual(parseGateForm('B', '3'), {
    ok: true,
    value: { name: 'B', sortOrder: 3 },
  });
  assert.deepEqual(parseGateForm('   ', null), {
    ok: false,
    error: 'gates.nameRequired',
  });
  assert.deepEqual(parseGateForm('x'.repeat(81), null), {
    ok: false,
    error: 'gates.nameTooLong',
  });
  assert.deepEqual(parseGateForm('B', '1.5'), {
    ok: false,
    error: 'gates.sortInvalid',
  });
  assert.deepEqual(parseGateForm('B', -1), {
    ok: false,
    error: 'gates.sortInvalid',
  });
});

test('parseGateList accepts API shape and rejects malformed', () => {
  assert.deepEqual(
    parseGateList({ gates: [{ id: 'g1', eventId: 'e', name: 'A', sortOrder: 2 }] }),
    [{ id: 'g1', name: 'A', sortOrder: 2 }],
  );
  assert.deepEqual(parseGateList({ gates: [] }), []);
  assert.equal(parseGateList({}), null);
  assert.equal(parseGateList({ gates: [{ id: 1 }] }), null);
});

test('interpretGateCreate maps 409 GATE_NAME_CONFLICT and others', () => {
  assert.equal(interpretGateCreate(201, {}, false).kind, 'created');
  assert.equal(
    interpretGateCreate(409, { code: 'GATE_NAME_CONFLICT' }, false).kind,
    'conflict',
  );
  assert.equal(interpretGateCreate(409, { code: 'OTHER' }, false).kind, 'failed');
  assert.equal(interpretGateCreate(403, null, false).kind, 'forbidden');
  assert.equal(interpretGateCreate(200, {}, true).kind, 'failed');
  assert.equal(interpretGateCreate(500, {}, false).kind, 'failed');
});

test('gate upstream paths carry tenantId for list and body for create', () => {
  assert.equal(
    PORTAL_UPSTREAM.gates('t1', 'e1'),
    '/v1/gate/events/e1/gates?tenantId=t1',
  );
  assert.equal(PORTAL_UPSTREAM.gateCreate('e1'), '/v1/gate/events/e1/gates');
});
