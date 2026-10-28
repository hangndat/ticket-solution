import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyStaffGateWorkspace,
  flushScopeIntoWorkspace,
  gateIdForSession,
  gateNameFromList,
  recordSessionGate,
  sliceWorkspaceForScope,
} from './staff-gate-workspace.ts';
import { createGateWorkspaceStore } from './staff-gate-workspace-store-core.ts';

const scope = { tenantId: 't1', eventId: 'e1', name: 'E' };

test('gate id persists with its session and survives a store round-trip', async () => {
  const bytes = new Map<string, string>();
  const store = createGateWorkspaceStore(
    {
      getItemAsync: async (k) => bytes.get(k) ?? null,
      setItemAsync: async (k, v) => { bytes.set(k, v); },
      deleteItemAsync: async (k) => { bytes.delete(k); },
    },
    async () => null,
  );
  let ws = flushScopeIntoWorkspace(emptyStaffGateWorkspace(), scope, [], 's1');
  ws = recordSessionGate(ws, scope, 's1', 'g1');
  await store.save('u', ws);
  const loaded = await store.load('u');
  assert.deepEqual(sliceWorkspaceForScope(loaded, scope).gateId, 'g1');
  assert.equal(sliceWorkspaceForScope(loaded, scope).sessionId, 's1');
  assert.ok(!JSON.stringify([...bytes.values()]).includes('gateName'));
});

test('gate id is dropped when the session is cleared or replaced', () => {
  let ws = flushScopeIntoWorkspace(emptyStaffGateWorkspace(), scope, [], 's1');
  ws = recordSessionGate(ws, scope, 's1', 'g1');
  assert.equal(gateIdForSession(ws, scope, 's1'), 'g1');
  assert.equal(gateIdForSession(ws, scope, 's2'), null);
  const replaced = flushScopeIntoWorkspace(ws, scope, [], 's2');
  assert.equal(sliceWorkspaceForScope(replaced, scope).gateId, null);
  const cleared = flushScopeIntoWorkspace(ws, scope, [], null);
  assert.equal(sliceWorkspaceForScope(cleared, scope).gateId, null);
  assert.equal(sliceWorkspaceForScope(cleared, scope).sessionId, null);
});

test('session without gate records nothing; old payloads without the field load', async () => {
  const ws = recordSessionGate(emptyStaffGateWorkspace(), scope, 's1', null);
  assert.deepEqual(ws.sessionGateByScope, {});
  assert.equal(sliceWorkspaceForScope(emptyStaffGateWorkspace(), scope).gateId, null);
});

test('gate name resolves from the API gates list by id', () => {
  const gates = [{ id: 'g1', name: 'Cổng A' }, { id: 'g2', name: 'Cổng B' }];
  assert.equal(gateNameFromList(gates, 'g2'), 'Cổng B');
  assert.equal(gateNameFromList(gates, 'gx'), null);
  assert.equal(gateNameFromList(gates, null), null);
});
