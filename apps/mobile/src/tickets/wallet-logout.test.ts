import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionBoundary, type CredentialStore } from '../identity/session-boundary.ts';
import { createDurableWriteGate } from './durable-write-gate.ts';
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
