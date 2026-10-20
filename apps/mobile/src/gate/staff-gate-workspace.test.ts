import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GateOp } from './gate-scan.ts';
import {
  applyWorkspaceSelection,
  flushScopeIntoWorkspace,
  opsForScope,
  scopeStorageKey,
  sliceWorkspaceForScope,
} from './staff-gate-workspace.ts';

const scopeA = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  eventId: '22222222-2222-2222-2222-222222222222',
  name: 'A',
};
const scopeB = {
  tenantId: '33333333-3333-3333-3333-333333333333',
  eventId: '44444444-4444-4444-4444-444444444444',
  name: 'B',
};

test('scope switch flushes session and ops per event', () => {
  const op: GateOp = {
    id: '1',
    ticketId: 't1',
    tenantId: scopeA.tenantId,
    eventId: scopeA.eventId,
    staffSessionId: 's1',
    phase: 'denied',
    message: 'x',
  };
  let ws = flushScopeIntoWorkspace(
    { v: 2, selected: scopeA, sessionsByScope: {}, opsByScope: {} },
    scopeA,
    [op],
    'sess-a',
  );
  ws = applyWorkspaceSelection(ws, scopeB, scopeA, [op], 'sess-a');
  const keyA = scopeStorageKey(scopeA);
  assert.equal(ws.sessionsByScope[keyA], 'sess-a');
  assert.equal(ws.opsByScope[keyA]?.length, 1);
  assert.deepEqual(sliceWorkspaceForScope(ws, scopeB), {
    ops: [],
    sessionId: null,
  });
});

test('opsForScope filters by tenant and event', () => {
  const ops: GateOp[] = [
    {
      id: '1',
      ticketId: 't',
      tenantId: scopeA.tenantId,
      eventId: scopeA.eventId,
      staffSessionId: '',
      phase: 'unknown',
      message: 'a',
    },
    {
      id: '2',
      ticketId: 't',
      tenantId: scopeB.tenantId,
      eventId: scopeB.eventId,
      staffSessionId: '',
      phase: 'unknown',
      message: 'b',
    },
  ];
  assert.equal(opsForScope(ops, scopeA).length, 1);
});
