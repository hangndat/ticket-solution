import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDurableGateOwnership } from './durable-gate-ownership.ts';
import { createGateWorkspaceStore } from './staff-gate-workspace-store-core.ts';
import { emptyStaffGateWorkspace } from './staff-gate-workspace.ts';

function fixture() {
  const bytes = new Map<string, string>();
  let fail: 'intent' | 'readback' | 'delete' | 'commit' | null = null;
  const workspace = (eventId: string) => ({
    ...emptyStaffGateWorkspace(),
    selected: { tenantId: 'tenant', eventId, name: eventId },
  });
  const list = async () => ({
    workspaceUserIds: [...bytes.keys()].filter((key) => key.startsWith('ticket.gate.workspace.v2.')).map((key) => key.slice('ticket.gate.workspace.v2.'.length)),
    scopeUserIds: [...bytes.keys()].filter((key) => key.startsWith('ticket.staff.gate.scope.v1.')).map((key) => key.slice('ticket.staff.gate.scope.v1.'.length)),
    queueUserIds: [...bytes.keys()].filter((key) => key.startsWith('ticket.gate.offline-queue.v1.')).map((key) => key.slice('ticket.gate.offline-queue.v1.'.length)),
    legacyOpsPresent: bytes.has('ticket.gate.ops.v1'),
  });
  const make = () => {
    const core = createGateWorkspaceStore({
      getItemAsync: async (key) => bytes.get(key) ?? null,
      setItemAsync: async (key, value) => { bytes.set(key, value); },
      deleteItemAsync: async (key) => {
        if (fail === 'delete' && key === 'ticket.gate.workspace.v2.A') throw new Error('delete failed');
        bytes.delete(key);
      },
    }, async () => null);
    return createDurableGateOwnership({
      readJournal: async () => fail === 'readback' ? null : bytes.get('owner') ?? null,
      writeJournal: async (raw) => {
        const body = JSON.parse(raw) as { lastVerifiedUserId: string | null; pendingPurgeUserIds: string[] };
        if (fail === 'intent' && body.pendingPurgeUserIds.length) throw new Error('intent failed');
        if (fail === 'commit' && body.pendingPurgeUserIds.length === 0 && body.lastVerifiedUserId === 'B') throw new Error('commit failed');
        bytes.set('owner', raw);
      },
      list, load: core.load, save: core.save, invalidate: core.invalidate, allow: core.allow,
      deletePartition: async (id) => {
        await core.beginPurge(id);
        bytes.delete(`ticket.gate.offline-queue.v1.${id}`);
      },
      deleteLegacy: async () => { bytes.delete('ticket.gate.ops.v1'); },
    });
  };
  return { bytes, make, workspace, setFail: (value: typeof fail) => { fail = value; } };
}

test('failed A delete persists pending intent; a new process purges A before A reauth', async () => {
  const f = fixture();
  f.bytes.set('ticket.gate.workspace.v2.A', JSON.stringify(f.workspace('old')));
  f.bytes.set('ticket.gate.offline-queue.v1.A', '[]');
  const first = f.make();
  f.setFail('delete');
  await assert.rejects(first.beginLogout('A', 1, async () => {}), /delete failed/);
  assert.deepEqual(JSON.parse(f.bytes.get('owner')!).pendingPurgeUserIds, ['A']);
  f.setFail(null);
  const restarted = f.make();
  await restarted.prepareVerified('A', 2);
  assert.equal((await restarted.load('A')).selected, null);
  assert.equal(f.bytes.has('ticket.gate.offline-queue.v1.A'), false);
});

test('failed intent, readback, and owner commit keep Gate blocked until retry', async () => {
  for (const failure of ['intent', 'readback', 'commit'] as const) {
    const f = fixture();
    f.bytes.set('ticket.gate.workspace.v2.A', JSON.stringify(f.workspace('private-A')));
    f.setFail(failure);
    const gate = f.make();
    await assert.rejects(gate.prepareVerified('B', 1));
    await assert.rejects(gate.load('B'));
    f.setFail(null);
    const restarted = f.make();
    await restarted.prepareVerified('B', 2);
    assert.equal(f.bytes.has('ticket.gate.workspace.v2.A'), false);
    assert.equal((await restarted.load('B')).selected, null);
  }
});

test('cold B purges pre-index A; unknown and verified same A retain M10 data', async () => {
  const f = fixture();
  f.bytes.set('ticket.gate.workspace.v2.A', JSON.stringify(f.workspace('M10')));
  f.bytes.set('ticket.gate.ops.v1', 'ownerless');
  const a = f.make();
  await a.prepareVerified('A', 1);
  assert.equal((await a.load('A')).selected?.eventId, 'M10');
  assert.equal(f.bytes.has('ticket.gate.ops.v1'), false);
  // Unknown/unreachable does not call a purge. A fresh process can reverify A.
  const aRestart = f.make();
  await aRestart.prepareVerified('A', 2);
  assert.equal((await aRestart.load('A')).selected?.eventId, 'M10');
  const bRestart = f.make();
  await bRestart.prepareVerified('B', 3);
  assert.equal(f.bytes.has('ticket.gate.workspace.v2.A'), false);
  assert.equal((await bRestart.load('B')).selected, null);
});
