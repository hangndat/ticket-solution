import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDurableWriteGate } from './durable-write-gate.ts';
import {
  OfflineDisplayBoundary,
  type OfflineDisplayBinding,
  type OfflineDisplayStore,
} from './offline-display.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function memoryStore(initial: OfflineDisplayBinding | null = null) {
  let binding = initial;
  const store: OfflineDisplayStore = {
    read: async () => binding,
    write: async (next) => {
      binding = next;
    },
    clear: async () => {
      binding = null;
    },
  };
  return {
    store,
    binding: () => binding,
  };
}

test('no prior binding hydrates to none — fail closed for offline wallet', async () => {
  const { store } = memoryStore(null);
  const boundary = new OfflineDisplayBoundary(store, createDurableWriteGate());
  const state = await boundary.hydrate();
  assert.equal(state.status, 'none');
  assert.equal(boundary.getSnapshot().status, 'none');
});

test('prior binding hydrates for offline restart without elevating verified', async () => {
  const { store } = memoryStore({
    userId: 'user-a',
    tenantId: 'tenant-1',
  });
  const boundary = new OfflineDisplayBoundary(store, createDurableWriteGate());
  const state = await boundary.hydrate();
  assert.equal(state.status, 'bound');
  if (state.status === 'bound') {
    assert.equal(state.userId, 'user-a');
    assert.equal(state.tenantId, 'tenant-1');
  }
});

test('logout clear removes durable binding', async () => {
  const f = memoryStore({ userId: 'user-a', tenantId: 'tenant-1' });
  const boundary = new OfflineDisplayBoundary(f.store, createDurableWriteGate());
  await boundary.hydrate();
  await boundary.clear();
  assert.equal(boundary.getSnapshot().status, 'none');
  assert.equal(f.binding(), null);
});

test('pending durable bind write does not resurrect after invalidate+clear', async () => {
  const f = memoryStore(null);
  const gate = createDurableWriteGate();
  const writing = deferred<void>();
  const release = deferred<void>();
  const realWrite = f.store.write;
  f.store.write = async (binding) => {
    writing.resolve();
    await release.promise;
    await realWrite(binding);
  };
  const boundary = new OfflineDisplayBoundary(f.store, gate);
  const epoch = gate.current();
  const bind = boundary.bindAfterOnlineVerify('user-a', 'tenant-1', epoch);
  await writing.promise;
  gate.invalidate();
  // clear() queues behind the in-flight write — release first to avoid deadlock.
  const cleared = boundary.clear();
  release.resolve();
  assert.equal(await bind, false);
  await cleared;
  assert.equal(f.binding(), null);
  assert.equal(boundary.getSnapshot().status, 'none');
});

test('account switch must not keep previous user binding', async () => {
  const f = memoryStore({ userId: 'user-a', tenantId: 'tenant-1' });
  const gate = createDurableWriteGate();
  const boundary = new OfflineDisplayBoundary(f.store, gate);
  await boundary.hydrate();
  await boundary.clear();
  assert.equal(boundary.getSnapshot().status, 'none');
  assert.equal(f.binding(), null);
  await boundary.bindAfterOnlineVerify('user-b', 'tenant-1', gate.current());
  const snap = boundary.getSnapshot();
  assert.equal(snap.status, 'bound');
  if (snap.status === 'bound') assert.equal(snap.userId, 'user-b');
});

test('binding clear deletion failure propagates while memory stays none', async () => {
  const f = memoryStore({ userId: 'user-a', tenantId: 'tenant-1' });
  f.store.clear = async () => {
    throw new Error('Keychain binding delete failed');
  };
  const boundary = new OfflineDisplayBoundary(f.store, createDurableWriteGate());
  await boundary.hydrate();
  await assert.rejects(boundary.clear(), /Keychain binding delete failed/);
  assert.equal(boundary.getSnapshot().status, 'none');
});
