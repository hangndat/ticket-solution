import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGateWorkspaceStore } from './staff-gate-workspace-store-core.ts';
import { createGateIdentityPurgeBarrier } from './gate-identity-purge-barrier.ts';
import { emptyStaffGateWorkspace } from './staff-gate-workspace.ts';
import { projectStaffGateOwnedSnapshot } from './staff-gate-owned-snapshot.ts';
import type { StaffGateWorkspaceValue } from './staff-gate-workspace-context.tsx';
import type { SessionEpoch } from '../identity/session-boundary.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('production Gate snapshot and storage hide A at every A→unknown→B render and handler boundary', async () => {
  const bytes = new Map<string, string>();
  const slowB = deferred();
  const storage = {
    getItemAsync: async (key: string) => {
      if (key.endsWith('.B')) await slowB.promise;
      return bytes.get(key) ?? null;
    },
    setItemAsync: async (key: string, value: string) => { bytes.set(key, value); },
    deleteItemAsync: async (key: string) => { bytes.delete(key); },
  };
  const store = createGateWorkspaceStore(storage, async () => null);
  const identityBarrier = createGateIdentityPurgeBarrier(store.beginPurge);
  const workspace = (eventId: string) => ({
    ...emptyStaffGateWorkspace(), selected: { tenantId: 'tenant', eventId, name: eventId },
  });
  await store.save('A', workspace('A'));
  await store.save('B', workspace('B'));
  const epochA: SessionEpoch = { userId: 'A', generation: 1 };
  const epochB: SessionEpoch = { userId: 'B', generation: 3 };
  let current: SessionEpoch | null = epochA;
  let owner: SessionEpoch | null = epochA;
  identityBarrier.observe('A');
  let actions = 0;
  const action = async () => { actions += 1; };
  const raw = {
    ready: true, ops: [{ id: 'A-secret' }], gateScope: workspace('A').selected,
    pendingOp: { id: 'A-secret' }, toastOp: { id: 'A-secret' },
    deviceHistory: [{ id: 'A-secret' }],
    queueSnap: { items: [{ id: 'A-secret' }], pendingCount: 1, conflictCount: 0, syncing: false, lastSyncError: null },
    submitScan: action, reconcile: action, syncNow: action, focusSync: action,
    refreshGateEvents: action, logoutStaff: action,
    importKnownOperation: async () => { actions += 1; return { kind: 'error' as const, code: 'stale' as const, message: '' }; },
    setEventPickerOpen: () => { actions += 1; }, selectGateScope: () => { actions += 1; },
    handleCameraScan: () => { actions += 1; }, dismissPendingAction: () => { actions += 1; },
  } as unknown as StaffGateWorkspaceValue;
  const project = () => {
    const projectedOwner = owner;
    return projectStaffGateOwnedSnapshot(raw, projectedOwner, current, () => owner === projectedOwner && current === projectedOwner);
  };
  const visibleA = project();
  assert.equal(visibleA.ops[0]?.id, 'A-secret');

  current = null; // Unknown/unreachable retains v2, but no memory/handler access.
  identityBarrier.observe(null);
  const unknown = project();
  assert.deepEqual(unknown.ops, []);
  assert.deepEqual(unknown.deviceHistory, []);
  assert.deepEqual(unknown.queueSnap.items, []);
  assert.equal(unknown.pendingOp, null);
  assert.equal(unknown.toastOp, null);
  assert.equal(unknown.gateScope, null);
  assert.deepEqual(unknown.gateEventChoices, []);
  assert.equal(unknown.sessionId, null);
  assert.equal(unknown.toastStatus.kind, 'idle');
  assert.equal(unknown.ready, false);
  await visibleA.submitScan('stale');
  await unknown.reconcile();
  await unknown.syncNow();
  await unknown.focusSync();
  await unknown.refreshGateEvents();
  await unknown.logoutStaff();
  unknown.handleCameraScan('stale');
  unknown.dismissPendingAction();
  unknown.setEventPickerOpen(true);
  assert.equal(actions, 0);
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), true);

  current = epochB; // Eligibility B resolves before Gate B's deferred load.
  identityBarrier.observe('B');
  const beforeBLoad = project();
  assert.equal(beforeBLoad.gateScope, null);
  assert.deepEqual(beforeBLoad.ops, []);
  await beforeBLoad.importKnownOperation('stale');
  beforeBLoad.selectGateScope(workspace('A').selected!);
  assert.equal(actions, 0);
  store.allow('B', epochB.generation);
  const loadB = store.load('B');
  await identityBarrier.wait();
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
  assert.deepEqual(project().deviceHistory, []);
  slowB.resolve();
  const hydratedB = await loadB;
  owner = epochB;
  raw.ops = [{ id: 'B-op' }] as StaffGateWorkspaceValue['ops'];
  raw.gateScope = hydratedB.selected as StaffGateWorkspaceValue['gateScope'];
  raw.deviceHistory = [];
  raw.pendingOp = null;
  raw.toastOp = null;
  raw.gateEventChoices = [];
  raw.queueSnap = { items: [], pendingCount: 0, conflictCount: 0, syncing: false, lastSyncError: null } as StaffGateWorkspaceValue['queueSnap'];
  assert.equal(project().gateScope?.eventId, 'B');
  assert.equal(project().ops[0]?.id, 'B-op');
  await visibleA.reconcile();
  assert.equal(actions, 0);
});
