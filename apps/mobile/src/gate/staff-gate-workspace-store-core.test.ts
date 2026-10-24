import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGateWorkspaceStore } from './staff-gate-workspace-store-core.ts';
import { emptyStaffGateWorkspace } from './staff-gate-workspace.ts';
import { gateWorkspaceOperationGuard } from './gate-workspace-operation-guard.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const bytes = new Map<string, string>();
  let beforeWrite: (() => Promise<void>) | null = null;
  const storage = {
    getItemAsync: async (key: string) => bytes.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      if (beforeWrite) await beforeWrite();
      bytes.set(key, value);
    },
    deleteItemAsync: async (key: string) => { bytes.delete(key); },
  };
  const store = createGateWorkspaceStore(storage, async () => null);
  return { bytes, store, setBeforeWrite: (value: (() => Promise<void>) | null) => { beforeWrite = value; } };
}

function workspace(id: string) {
  return { ...emptyStaffGateWorkspace(), selected: { tenantId: 'tenant', eventId: id, name: id } };
}

test('logout waits for a running durable write, then deletes it and blocks a late write', async () => {
  const { bytes, store, setBeforeWrite } = fixture();
  const started = deferred<void>();
  const release = deferred<void>();
  setBeforeWrite(async () => { started.resolve(); await release.promise; });
  const old = store.save('A', workspace('old'));
  await started.promise;
  store.invalidate('A'); // wallet logout runs this before its first await
  const purge = store.clear('A');
  const stale = store.save('A', workspace('late'));
  release.resolve();
  await Promise.all([old, purge, stale]);
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
  store.allow('A'); // same-user reauthentication
  await store.save('A', workspace('new'));
  assert.equal((await store.load('A')).selected?.eventId, 'new');
});

test('logout first blocks a queued write; B workspace survives A purge', async () => {
  const { bytes, store } = fixture();
  await store.save('B', workspace('B'));
  const stale = store.save('A', workspace('old'));
  store.invalidate('A');
  await Promise.all([stale, store.clear('A')]);
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
  assert.equal((await store.load('B')).selected?.eventId, 'B');
});

test('wallet entrypoint invalidation fires synchronously and blocks rehydrate before credential logout', async () => {
  const { store } = fixture();
  await store.save('A', workspace('A'));
  const invalidated: string[] = [];
  const unsubscribe = store.subscribeInvalidation((userId) => invalidated.push(userId));
  store.invalidate('A');
  assert.deepEqual(invalidated, ['A']);
  assert.equal((await store.load('A')).selected, null);
  await store.clear('A');
  unsubscribe();
});

test('old verified mount cannot reopen a logout-blocked writer before reauthentication', async () => {
  const { bytes, store } = fixture();
  store.invalidate('A', 7);
  store.allow('A', 7);
  await store.save('A', workspace('stale'));
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
  await store.clear('A');
  store.allow('A', 8);
  await store.save('A', workspace('new'));
  assert.equal((await store.load('A')).selected?.eventId, 'new');
});

test('production purge barrier holds same-user reauth through deferred cleanup and preserves new writes', async () => {
  const { bytes, store } = fixture();
  await store.save('A', workspace('old'));
  const apns = deferred<void>();
  const queue = deferred<void>();
  const order: string[] = [];
  const purge = store.beginPurge('A', 1, async () => {
    order.push('apns');
    await apns.promise;
    order.push('queue');
    await queue.promise;
  });
  // The fence is installed before the cleanup callback can await APNs.
  assert.equal(store.current('A', store.generation('A')), false);
  store.allow('A', 1); // old mount cannot reopen it
  assert.equal((await Promise.race([store.save('A', workspace('late')).then(() => 'saved'), Promise.resolve('blocked')])), 'blocked');
  store.allow('A', 2);
  let loaded = false;
  const newLoad = store.load('A').then((value) => { loaded = true; return value; });
  const newSave = store.save('A', workspace('new'));
  await Promise.resolve();
  assert.equal(loaded, false);
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), true);
  apns.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ['apns', 'queue']);
  assert.equal(loaded, false);
  queue.resolve();
  await purge;
  assert.equal((await newLoad).selected, null);
  await newSave;
  assert.equal((await store.load('A')).selected?.eventId, 'new');
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), true);
});

test('verified B can purge A while B activation and writes remain independent', async () => {
  const { bytes, store } = fixture();
  await store.save('A', workspace('A'));
  await store.save('B', workspace('B'));
  bytes.set('ticket.staff.gate.scope.v1.A', JSON.stringify(workspace('A').selected));
  bytes.set('ticket.staff.gate.scope.v1.B', JSON.stringify(workspace('B').selected));
  const oldPurge = store.beginPurge('A', 1);
  store.allow('B', 2);
  await oldPurge;
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
  assert.equal(bytes.has('ticket.staff.gate.scope.v1.A'), false);
  assert.equal(bytes.has('ticket.staff.gate.scope.v1.B'), true);
  assert.equal((await store.load('B')).selected?.eventId, 'B');
});

test('failed delete remains fail closed until a later purge succeeds', async () => {
  const bytes = new Map<string, string>();
  bytes.set('ticket.gate.workspace.v2.A', JSON.stringify(workspace('old')));
  bytes.set('ticket.gate.ops.v1', JSON.stringify([{ id: 'ownerless' }]));
  let failDelete = true;
  const store = createGateWorkspaceStore({
    getItemAsync: async (key) => bytes.get(key) ?? null,
    setItemAsync: async (key, value) => { bytes.set(key, value); },
    deleteItemAsync: async (key) => {
      if (key === 'ticket.gate.workspace.v2.A' && failDelete) throw new Error('SecureStore delete failed');
      bytes.delete(key);
    },
  }, async () => null);
  await assert.rejects(store.beginPurge('A', 1), /SecureStore delete failed/);
  assert.equal(bytes.has('ticket.gate.ops.v1'), false);
  store.allow('A', 2);
  assert.equal((await store.load('A')).selected, null);
  await store.save('A', workspace('new'));
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), true);
  failDelete = false;
  const retry = store.beginPurge('A', 1);
  store.allow('A', 2);
  await retry;
  await store.save('A', workspace('new'));
  assert.equal((await store.load('A')).selected?.eventId, 'new');
});

test('ownerless legacy operations are purged at migration and logout, never rehydrated for A or B', async () => {
  const { bytes, store } = fixture();
  bytes.set('ticket.gate.ops.v1', JSON.stringify([{ id: 'A-op', tenantId: 'tenant', eventId: 'event' }]));
  const a = await store.load('A');
  assert.deepEqual(a.opsByScope, {});
  assert.equal(bytes.has('ticket.gate.ops.v1'), false);
  bytes.set('ticket.gate.ops.v1', JSON.stringify([{ id: 'A-op' }]));
  await store.clear('A');
  store.allow('A');
  assert.deepEqual((await store.load('A')).opsByScope, {});
  assert.deepEqual((await store.load('B')).opsByScope, {});
  assert.equal(bytes.has('ticket.gate.ops.v1'), false);
});

test('unreachable cold start retains only the verified user v2 partition', async () => {
  const { bytes, store } = fixture();
  await store.save('A', workspace('A'));
  await store.save('B', workspace('B'));
  bytes.set('ticket.gate.ops.v1', JSON.stringify([{ id: 'ownerless' }]));
  assert.equal((await store.load('A')).selected?.eventId, 'A');
  assert.equal((await store.load('B')).selected?.eventId, 'B');
  assert.equal(bytes.has('ticket.gate.workspace.v2.A'), true);
});

for (const kind of ['runScan', 'reconcileOp'] as const) {
  for (const transition of ['logout', 'same-user reauth', 'A to B'] as const) {
    test(`${kind} deferred response is fenced after ${transition}`, async () => {
      const { bytes, store } = fixture();
      await store.save('B', workspace('B'));
      const response = deferred<string>();
      let user: string | null = 'A';
      let epoch = 1;
      let feedbackGeneration = 1;
      const view = { gateScope: { tenantId: 'tenant', eventId: 'A', name: 'A' }, sessionId: 'session-A' };
      const capturedEpoch = epoch;
      const capturedWriteGeneration = store.generation('A');
      const current = gateWorkspaceOperationGuard({
        startedUserId: 'A', startedView: { ...view }, startedGeneration: feedbackGeneration,
        writeGeneration: capturedWriteGeneration,
        isEpochCurrent: () => epoch === capturedEpoch,
        currentUserId: () => user,
        currentView: () => view,
        currentGeneration: () => feedbackGeneration,
        isWriteGenerationCurrent: () => store.current('A', capturedWriteGeneration),
      });
      const feedback: string[] = [];
      const task = (async () => {
        const result = await response.promise;
        if (!current()) return;
        await store.save('A', workspace(result), current);
        if (current()) feedback.push(result);
      })();
      if (transition === 'logout') {
        store.invalidate('A');
        await store.clear('A');
        user = null;
      } else if (transition === 'same-user reauth') {
        epoch += 1;
        feedbackGeneration += 1;
      } else {
        epoch += 1;
        user = 'B';
        view.gateScope = { tenantId: 'tenant', eventId: 'B', name: 'B' };
        view.sessionId = 'session-B';
      }
      response.resolve('old-operation');
      await task;
      assert.deepEqual(feedback, []);
      assert.equal(bytes.has('ticket.gate.workspace.v2.A'), false);
      assert.equal((await store.load('B')).selected?.eventId, 'B');
    });
  }
}
