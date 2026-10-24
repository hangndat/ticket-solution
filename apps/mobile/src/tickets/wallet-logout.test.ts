import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREDENTIAL_UNREACHABLE, SessionBoundary, type CredentialStore } from '../identity/session-boundary.ts';
import { createDurableWriteGate } from './durable-write-gate.ts';
import { createGateWorkspaceStore } from '../gate/staff-gate-workspace-store-core.ts';
import { emptyStaffGateWorkspace } from '../gate/staff-gate-workspace.ts';
import { captureLogoutSessionGuard, startWalletLogoutTransaction } from './wallet-logout-transaction.ts';
import {
  OfflineDisplayBoundary,
  type OfflineDisplayStore,
} from './offline-display.ts';

/**
 * Mirrors logoutAndClearWalletArtifacts ordering with injected stores:
 * gate invalidate → memory invalidate → attempt all cleanups → aggregate errors.
 */
async function logoutSequence(input: {
  boundary: SessionBoundary;
  offline: OfflineDisplayBoundary;
  cacheGate: ReturnType<typeof createDurableWriteGate>;
  bindingGate: ReturnType<typeof createDurableWriteGate>;
  clearTicketCache: () => Promise<void>;
}) {
  input.cacheGate.invalidate();
  input.bindingGate.invalidate();
  input.offline.invalidateMemory();
  const errors: Error[] = [];
  try {
    await input.boundary.logout();
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }
  try {
    await input.offline.clear();
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }
  try {
    await input.clearTicketCache();
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new Error(errors.map((error) => error.message).join('; '));
  }
}

function fixture() {
  let credential: string | null = null;
  const store: CredentialStore = {
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  };
  let binding: { userId: string; tenantId: string } | null = {
    userId: 'user-a',
    tenantId: 'tenant-1',
  };
  const offlineStore: OfflineDisplayStore = {
    read: async () => binding,
    write: async (next) => {
      binding = next;
    },
    clear: async () => {
      binding = null;
    },
  };
  const bindingGate = createDurableWriteGate();
  return {
    boundary: new SessionBoundary(store),
    offline: new OfflineDisplayBoundary(offlineStore, bindingGate),
    credential: () => credential,
    binding: () => binding,
    store,
    cacheGate: createDurableWriteGate(),
    bindingGate,
  };
}

test('logout sequence clears session memory, binding, and bumps write gates', async () => {
  const f = fixture();
  await f.boundary.establish('alice', async () => ({ userId: 'user-a' }));
  await f.offline.hydrate();
  assert.equal(f.offline.getSnapshot().status, 'bound');
  const ticketEpoch = f.cacheGate.current();
  const bindingEpoch = f.bindingGate.current();
  let cacheCleared = false;
  await logoutSequence({
    boundary: f.boundary,
    offline: f.offline,
    cacheGate: f.cacheGate,
    bindingGate: f.bindingGate,
    clearTicketCache: async () => {
      cacheCleared = true;
    },
  });
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
  assert.equal(f.offline.getSnapshot().status, 'none');
  assert.equal(f.binding(), null);
  assert.equal(cacheCleared, true);
  assert.equal(f.cacheGate.current(), ticketEpoch + 1);
  assert.equal(f.bindingGate.current(), bindingEpoch + 1);
});

test('credential delete failure still clears binding/cache and aggregates error', async () => {
  const f = fixture();
  await f.boundary.establish('alice', async () => ({ userId: 'user-a' }));
  await f.offline.hydrate();
  f.store.clear = async () => {
    throw new Error('Keychain credential delete failed');
  };
  let cacheCleared = false;
  await assert.rejects(
    logoutSequence({
      boundary: f.boundary,
      offline: f.offline,
      cacheGate: f.cacheGate,
      bindingGate: f.bindingGate,
      clearTicketCache: async () => {
        cacheCleared = true;
      },
    }),
    /Keychain credential delete failed/,
  );
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.offline.getSnapshot().status, 'none');
  assert.equal(f.binding(), null);
  assert.equal(cacheCleared, true);
});

test('ticket-cache deletion failure propagates after session cleared', async () => {
  const f = fixture();
  await f.boundary.establish('alice', async () => ({ userId: 'user-a' }));
  await f.offline.hydrate();
  await assert.rejects(
    logoutSequence({
      boundary: f.boundary,
      offline: f.offline,
      cacheGate: f.cacheGate,
      bindingGate: f.bindingGate,
      clearTicketCache: async () => {
        throw new Error('SecureStore ticket delete failed');
      },
    }),
    /SecureStore ticket delete failed/,
  );
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.offline.getSnapshot().status, 'none');
});

for (const reauth of ['before purge', 'after purge'] as const) {
  test(`production logout transaction fences APNs/queue and preserves ${reauth} reauthentication`, async () => {
    const f = fixture();
    await f.boundary.establish('old-credential', async () => ({ userId: 'user-a' }));
    const oldEpoch = f.boundary.captureEpoch()!;
    const bytes = new Map<string, string>();
    const gate = createGateWorkspaceStore({
      getItemAsync: async (key) => bytes.get(key) ?? null,
      setItemAsync: async (key, value) => { bytes.set(key, value); },
      deleteItemAsync: async (key) => { bytes.delete(key); },
    }, async () => null);
    const workspace = (eventId: string) => ({
      ...emptyStaffGateWorkspace(), selected: { tenantId: 'tenant', eventId, name: eventId },
    });
    await gate.save('user-a', workspace('old'));
    let releaseApns!: () => void;
    let releaseQueue!: () => void;
    const apns = new Promise<void>((done) => { releaseApns = done; });
    const queue = new Promise<void>((done) => { releaseQueue = done; });
    let apnsStarted!: () => void;
    const atApns = new Promise<void>((done) => { apnsStarted = done; });
    let queueStarted!: () => void;
    const atQueue = new Promise<void>((done) => { queueStarted = done; });
    const transaction = startWalletLogoutTransaction({
      userId: 'user-a', sessionGeneration: oldEpoch.generation,
      beginPurge: gate.beginPurge,
      beforeSessionLogout: [{ failure: 'APNs', run: async () => { apnsStarted(); await apns; } }],
      isSessionCurrent: () => f.boundary.isEpochCurrent(oldEpoch),
      logoutSession: () => f.boundary.logout(),
      afterSessionLogout: [{ failure: 'queue', run: async () => { queueStarted(); await queue; } }],
    });
    assert.equal(gate.current('user-a', gate.generation('user-a')), false);
    await atApns;
    if (reauth === 'before purge') {
      await f.boundary.establish('new-credential', async () => ({ userId: 'user-a' }));
      gate.allow('user-a', f.boundary.captureEpoch()!.generation);
    }
    let loaded = false;
    const pendingLoad = reauth === 'before purge'
      ? gate.load('user-a').then((value) => { loaded = true; return value; })
      : null;
    releaseApns();
    await atQueue;
    assert.equal(loaded, false);
    assert.equal(bytes.has('ticket.gate.workspace.v2.user-a'), true);
    releaseQueue();
    await transaction;
    if (reauth === 'after purge') {
      await f.boundary.establish('new-credential', async () => ({ userId: 'user-a' }));
      gate.allow('user-a', f.boundary.captureEpoch()!.generation);
    } else {
      assert.equal((await pendingLoad)!.selected, null);
    }
    assert.equal(f.credential(), 'new-credential');
    await gate.save('user-a', workspace('new'));
    assert.equal((await gate.load('user-a')).selected?.eventId, 'new');
  });
}

test('overlapping logout of a newly reauthenticated A runs its own session cleanup behind one purge', async () => {
  const f = fixture();
  await f.boundary.establish('old', async () => ({ userId: 'user-a' }));
  const oldEpoch = f.boundary.captureEpoch()!;
  const bytes = new Map<string, string>();
  const gate = createGateWorkspaceStore({
    getItemAsync: async (key) => bytes.get(key) ?? null,
    setItemAsync: async (key, value) => { bytes.set(key, value); },
    deleteItemAsync: async (key) => { bytes.delete(key); },
  }, async () => null);
  let releaseOld!: () => void;
  const holdOld = new Promise<void>((done) => { releaseOld = done; });
  const first = startWalletLogoutTransaction({
    userId: 'user-a', sessionGeneration: oldEpoch.generation, beginPurge: gate.beginPurge,
    beforeSessionLogout: [{ failure: 'APNs', run: () => holdOld }],
    isSessionCurrent: () => f.boundary.isEpochCurrent(oldEpoch),
    logoutSession: () => f.boundary.logout(), afterSessionLogout: [],
  });
  await f.boundary.establish('new', async () => ({ userId: 'user-a' }));
  const newEpoch = f.boundary.captureEpoch()!;
  gate.allow('user-a', newEpoch.generation);
  const second = startWalletLogoutTransaction({
    userId: 'user-a', sessionGeneration: newEpoch.generation, beginPurge: gate.beginPurge,
    beforeSessionLogout: [],
    isSessionCurrent: () => f.boundary.isEpochCurrent(newEpoch),
    logoutSession: () => f.boundary.logout(), afterSessionLogout: [],
  });
  releaseOld();
  await Promise.all([first, second]);
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
  assert.equal(gate.current('user-a', gate.generation('user-a')), false);
  assert.equal(bytes.has('ticket.gate.workspace.v2.user-a'), false);
});

test('explicit logout after unreachable restore clears retained credential without invalidating later sign-in', async () => {
  const f = fixture();
  await f.boundary.establish('retained', async () => CREDENTIAL_UNREACHABLE);
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), 'retained');
  const guard = captureLogoutSessionGuard(f.boundary);
  const clear = startWalletLogoutTransaction({
    userId: null, sessionGeneration: guard.generation,
    beginPurge: async (_userId, _generation, beforeDelete) => { await beforeDelete(); },
    beforeSessionLogout: [], isSessionCurrent: guard.isCurrent,
    logoutSession: () => f.boundary.logout(), afterSessionLogout: [],
  });
  await clear;
  assert.equal(f.credential(), null);
  await f.boundary.establish('new', async () => ({ userId: 'B' }));
  assert.equal(f.credential(), 'new');
});
