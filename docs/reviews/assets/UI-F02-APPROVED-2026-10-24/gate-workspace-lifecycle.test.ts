import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  invalidateGateWorkspaceLifecycle,
  isGateWorkspaceLifecycleCurrent,
  loadWorkspaceWithLifecycleGuard,
  scheduleGateWorkspaceLifecycleWork,
} from './gate-workspace-lifecycle.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('scheduleGateWorkspaceLifecycleWork serializes overlapping foreground steps', async () => {
  const generationRef = { current: 0 };
  const chainRef = { current: Promise.resolve() };
  const log: string[] = [];
  const firstGate = deferred<void>();
  const secondGate = deferred<void>();

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async (token) => {
    log.push('a-start');
    await firstGate.promise;
    if (!isGateWorkspaceLifecycleCurrent(generationRef, token)) return;
    log.push('a-end');
  });

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async (token) => {
    log.push('b-start');
    await secondGate.promise;
    if (!isGateWorkspaceLifecycleCurrent(generationRef, token)) return;
    log.push('b-end');
  });

  await new Promise<void>((r) => setImmediate(r));
  assert.deepEqual(log, ['a-start'], 'second step must wait for first await');

  firstGate.resolve();
  await new Promise<void>((r) => setImmediate(r));
  assert.deepEqual(log, ['a-start', 'a-end', 'b-start']);

  secondGate.resolve();
  await chainRef.current;
  assert.deepEqual(log, ['a-start', 'a-end', 'b-start', 'b-end']);
});

test('invalidateGateWorkspaceLifecycle blocks stale work after await (hydrate fence)', async () => {
  const generationRef = { current: 0 };
  const chainRef = { current: Promise.resolve() };
  const hydrateGate = deferred<void>();
  let enteredAwait = false;
  let persisted = false;

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async (token) => {
    enteredAwait = true;
    await hydrateGate.promise;
    if (!isGateWorkspaceLifecycleCurrent(generationRef, token)) return;
    persisted = true;
  });

  for (let i = 0; i < 20 && !enteredAwait; i += 1) {
    await new Promise<void>((r) => setImmediate(r));
  }
  assert.equal(enteredAwait, true, 'work must enter await before invalidate');

  invalidateGateWorkspaceLifecycle(generationRef);
  hydrateGate.resolve();
  await chainRef.current;

  assert.equal(persisted, false, 'logout/user change must not persist after stale hydrate');
});

test('loadWorkspaceWithLifecycleGuard drops stale hydrate after await', async () => {
  const generationRef = { current: 0 };
  const hydrateGate = deferred<{ owner: string }>();
  let inLoadAwait = false;

  const loadPromise = loadWorkspaceWithLifecycleGuard(
    generationRef,
    0,
    async () => {
      inLoadAwait = true;
      await hydrateGate.promise;
      return { owner: 'user-a' };
    },
  );

  for (let i = 0; i < 20 && !inLoadAwait; i += 1) {
    await new Promise<void>((r) => setImmediate(r));
  }
  assert.equal(inLoadAwait, true, 'load must enter await before invalidate');
  invalidateGateWorkspaceLifecycle(generationRef);
  hydrateGate.resolve({ owner: 'user-a' });
  const loaded = await loadPromise;
  assert.equal(loaded, null, 'must not return user-A workspace after generation switch');
});

test('eager not-ready before schedule blocks stale ready while prior mount awaits', async () => {
  const generationRef = { current: 0 };
  const chainRef = { current: Promise.resolve() };
  const userALoad = deferred<void>();
  let ready = true;

  const beginUserMount = () => {
    ready = false;
    invalidateGateWorkspaceLifecycle(generationRef);
    const token = generationRef.current;
    void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async (lifecycleToken) => {
      await userALoad.promise;
      if (!isGateWorkspaceLifecycleCurrent(generationRef, lifecycleToken)) return;
      ready = true;
    });
    return token;
  };

  beginUserMount();
  assert.equal(ready, false, 'user A mount must clear ready before queued work runs');
  beginUserMount();
  assert.equal(ready, false, 'user B switch must not show ready while A mount still in flight');
  userALoad.resolve();
  await chainRef.current;
  assert.equal(ready, true, 'only current generation mount may set ready');
});

test('mount then foreground stays ordered on one chain', async () => {
  const generationRef = { current: 0 };
  const chainRef = { current: Promise.resolve() };
  const log: string[] = [];
  const mountGate = deferred<void>();

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async () => {
    log.push('mount-load');
    await mountGate.promise;
    log.push('mount-refresh');
  });

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async () => {
    log.push('foreground-sync');
  });

  await new Promise<void>((r) => setImmediate(r));
  assert.deepEqual(log, ['mount-load'], 'foreground must not run before mount hydrate completes');

  mountGate.resolve();
  await chainRef.current;
  assert.deepEqual(log, ['mount-load', 'mount-refresh', 'foreground-sync']);
});
