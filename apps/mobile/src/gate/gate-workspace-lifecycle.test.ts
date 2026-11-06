import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canRetryGateWorkspaceLoad,
  invalidateGateWorkspaceLifecycle,
  isGateWorkspaceLifecycleCurrent,
  loadWorkspaceWithLifecycleGuard,
  scheduleGateWorkspaceLifecycleWork,
} from './gate-workspace-lifecycle.ts';
import { buildDeviceScanHistory } from './staff-gate-device-history.ts';
import type { GateOp } from './gate-scan.ts';

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

test('focus connectivity sync waits behind in-flight mount hydrate', async () => {
  const generationRef = { current: 0 };
  const chainRef = { current: Promise.resolve() };
  const log: string[] = [];
  const mountGate = deferred<void>();

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async () => {
    log.push('mount-load');
    await mountGate.promise;
    log.push('mount-done');
  });

  void scheduleGateWorkspaceLifecycleWork(generationRef, chainRef, async () => {
    log.push('focus-connectivity');
  });

  await new Promise<void>((r) => setImmediate(r));
  assert.deepEqual(log, ['mount-load'], 'focus must not run before mount hydrate completes');

  mountGate.resolve();
  await chainRef.current;
  assert.deepEqual(log, ['mount-load', 'mount-done', 'focus-connectivity']);
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

test('failed hydrate can retry twice and reveal only recovered device history', async () => {
  const generationRef = { current: 0 };
  const epoch = { userId: 'staff-a', generation: 3 };
  const scope = { tenantId: 'tenant-a', eventId: 'event-a', name: 'Event A' };
  const row: GateOp = {
    id: 'operation-a', ticketId: 'ticket-a', tenantId: scope.tenantId,
    eventId: scope.eventId, staffSessionId: 'session-a', phase: 'admitted',
    admissionKind: 'fresh', message: 'ok', recordedAt: '2026-11-06T10:00:00.000Z',
  };
  let attempts = 0;
  let ready = false;
  let loadError = false;
  let visible: ReturnType<typeof buildDeviceScanHistory> = [];
  const load = async () => {
    attempts += 1;
    if (attempts <= 2) throw new Error('SecureStore unavailable');
    return { scope, ops: [row] };
  };
  const attempt = async () => {
    loadError = false;
    ready = false;
    visible = [];
    const token = invalidateGateWorkspaceLifecycle(generationRef);
    try {
      const workspace = await loadWorkspaceWithLifecycleGuard(generationRef, token, load);
      if (!workspace) return;
      visible = buildDeviceScanHistory(workspace.scope, workspace.ops, []);
      ready = true;
    } catch {
      if (isGateWorkspaceLifecycleCurrent(generationRef, token)) loadError = true;
    }
  };
  await attempt();
  assert.equal(loadError, true);
  assert.equal(ready, false);
  assert.deepEqual(visible, []);
  assert.equal(canRetryGateWorkspaceLoad({
    requested: epoch, current: epoch, verifiedUserId: epoch.userId,
    active: true, loadError, ready, pending: false,
    hasScope: false, hasSession: false,
  }), true);
  await attempt();
  assert.equal(loadError, true, 'retry error remains recoverable');
  assert.deepEqual(visible, []);
  await attempt();
  assert.equal(attempts, 3);
  assert.equal(loadError, false);
  assert.equal(ready, true);
  assert.equal(visible.length, 1);
  assert.equal((visible as ReturnType<typeof buildDeviceScanHistory>)[0]?.id, 'operation-a');
});

test('workspace retry rejects changed user, epoch, scope, or active session', () => {
  const base = {
    requested: { userId: 'staff-a', generation: 1 },
    current: { userId: 'staff-a', generation: 1 },
    verifiedUserId: 'staff-a', active: true, loadError: true,
    ready: false, pending: false, hasScope: false, hasSession: false,
  };
  assert.equal(canRetryGateWorkspaceLoad(base), true);
  assert.equal(canRetryGateWorkspaceLoad({ ...base, current: { userId: 'staff-b', generation: 2 } }), false);
  assert.equal(canRetryGateWorkspaceLoad({ ...base, current: { userId: 'staff-a', generation: 2 } }), false);
  assert.equal(canRetryGateWorkspaceLoad({ ...base, hasScope: true }), false);
  assert.equal(canRetryGateWorkspaceLoad({ ...base, hasSession: true }), false);
  assert.equal(canRetryGateWorkspaceLoad({ ...base, pending: true }), false);
});
