import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CREDENTIAL_UNREACHABLE,
  SessionBoundary,
  type CredentialStore,
} from '../identity/session-boundary.ts';
import { createDurableWriteGate } from './durable-write-gate.ts';
import {
  OfflineDisplayBoundary,
  type OfflineDisplayBinding,
  type OfflineDisplayStore,
} from './offline-display.ts';
import type { TicketDisplayCache } from './display-cache-types.ts';
import { decideTicketSyncApply } from './ticket-sync-guard.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function credentialFixture(initial: string | null = null) {
  let credential = initial;
  const store: CredentialStore = {
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  };
  return {
    boundary: new SessionBoundary(store),
    credential: () => credential,
    store,
  };
}

function offlineFixture(initial: OfflineDisplayBinding | null = null) {
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
  const gate = createDurableWriteGate();
  return {
    offline: new OfflineDisplayBoundary(store, gate),
    binding: () => binding,
    store,
    gate,
  };
}

/** In-memory per-user ticket cache with write-gate serialization. */
function memoryTicketCache() {
  const gate = createDurableWriteGate();
  const rows = new Map<string, TicketDisplayCache>();
  const key = (userId: string, tenantId: string) => `${userId}:${tenantId}`;
  return {
    gate,
    read: async (userId: string, tenantId: string) =>
      rows.get(key(userId, tenantId)) ?? null,
    write: async (cache: TicketDisplayCache, writeEpoch: number) => {
      if (!gate.isCurrent(writeEpoch)) return false;
      rows.set(key(cache.userId, cache.tenantId), cache);
      if (!gate.isCurrent(writeEpoch)) {
        rows.delete(key(cache.userId, cache.tenantId));
        return false;
      }
      return true;
    },
    clear: async (userId: string, tenantId: string) => {
      rows.delete(key(userId, tenantId));
    },
    rows,
  };
}

const ticketA = {
  ticketId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tenantId: 'tenant-1',
  eventId: '33333333-3333-3333-3333-333333333333',
  ticketTypeId: '44444444-4444-4444-4444-444444444444',
  sourceId: '55555555-5555-5555-5555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  gateCredential: { v: 1, kind: "ticket.gate_credential", jws: "header.payload.signature" } as const,
  manualEntryCode: "ABCD-EFGH-JK",
  createdAt: '2026-10-16T00:00:00.000Z',
};

const ticketB = {
  ...ticketA,
  ticketId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

test('stale A tickets response after establish B does not write memory or durable cache', async () => {
  const f = credentialFixture();
  const cache = memoryTicketCache();
  await f.boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const epochA = f.boundary.captureEpoch();
  assert.ok(epochA);
  const writeEpoch = cache.gate.current();
  const late = deferred<{ tickets: typeof ticketA[] }>();
  const controller = f.boundary.beginRequest();

  const pending = (async () => {
    const body = await late.promise;
    if (!f.boundary.isEpochCurrent(epochA)) return 'stale';
    const decision = decideTicketSyncApply({
      epoch: epochA,
      isEpochCurrent: (e) => f.boundary.isEpochCurrent(e),
      probe: { status: 'ok', body },
      cached: null,
      expectedUserId: 'user-a',
    });
    if (decision.action !== 'apply') return decision.action;
    await cache.write(
      {
        userId: 'user-a',
        tenantId: 'tenant-1',
        syncedAt: decision.syncedAt,
        tickets: decision.tickets,
      },
      writeEpoch,
    );
    await f.boundary.load('tenant-1', 'me-tickets', async () => decision.tickets);
    return 'applied';
  })();

  await f.boundary.establish('tok-b', async () => ({ userId: 'user-b' }));
  assert.equal(controller.signal.aborted, true);
  f.boundary.endRequest(controller);
  cache.gate.invalidate();
  await f.boundary.load('tenant-1', 'me-tickets', async () => [ticketB]);
  late.resolve({ tickets: [ticketA] });
  assert.equal(await pending, 'stale');
  assert.deepEqual(f.boundary.read('tenant-1', 'me-tickets'), [ticketB]);
  assert.equal(await cache.read('user-a', 'tenant-1'), null);
});

test('same-user relogin drops previous session ticket write', async () => {
  const f = credentialFixture();
  const cache = memoryTicketCache();
  await f.boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const epoch = f.boundary.captureEpoch();
  const writeEpoch = cache.gate.current();
  const late = deferred<void>();
  const pending = (async () => {
    await late.promise;
    if (!f.boundary.isEpochCurrent(epoch)) return false;
    return cache.write(
      {
        userId: 'user-a',
        tenantId: 'tenant-1',
        syncedAt: '2026-10-16T12:00:00.000Z',
        tickets: [ticketA],
      },
      writeEpoch,
    );
  })();
  await f.boundary.logout();
  cache.gate.invalidate();
  await f.boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  late.resolve();
  assert.equal(await pending, false);
  assert.equal(await cache.read('user-a', 'tenant-1'), null);
});

test('pending durable cache write after logout does not resurrect storage', async () => {
  const cache = memoryTicketCache();
  const writing = deferred<void>();
  const release = deferred<void>();
  const writeEpoch = cache.gate.current();
  const originalWrite = cache.write;
  cache.write = async (row, epoch) => {
    writing.resolve();
    await release.promise;
    return originalWrite(row, epoch);
  };
  const pending = cache.write(
    {
      userId: 'user-a',
      tenantId: 'tenant-1',
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticketA],
    },
    writeEpoch,
  );
  await writing.promise;
  cache.gate.invalidate();
  await cache.clear('user-a', 'tenant-1');
  release.resolve();
  assert.equal(await pending, false);
  assert.equal(await cache.read('user-a', 'tenant-1'), null);
});

test('stale offline binding write does not clear newer account binding', async () => {
  const gate = createDurableWriteGate();
  const box: { current: OfflineDisplayBinding | null } = { current: null };
  const store: OfflineDisplayStore = {
    read: async () => box.current,
    write: async (next) => {
      box.current = next;
    },
    clear: async () => {
      box.current = null;
    },
  };
  const writing = deferred<void>();
  const release = deferred<void>();
  const realWrite = store.write;
  store.write = async (next) => {
    if (next.userId === 'user-a') {
      writing.resolve();
      await release.promise;
    }
    await realWrite(next);
  };
  const offline = new OfflineDisplayBoundary(store, gate);
  const writeEpochA = gate.current();
  const bindA = offline.bindAfterOnlineVerify('user-a', 'tenant-1', writeEpochA);
  await writing.promise;
  gate.invalidate();
  // B queues behind A's in-flight write — release A before awaiting B.
  const bindB = offline.bindAfterOnlineVerify(
    'user-b',
    'tenant-1',
    gate.current(),
  );
  release.resolve();
  assert.equal(await bindA, false);
  assert.equal(await bindB, true);
  assert.equal(box.current?.userId, 'user-b');
});

test('hydrate generation guard drops late read after clear', async () => {
  const f = offlineFixture({ userId: 'user-a', tenantId: 'tenant-1' });
  const reading = deferred<void>();
  const release = deferred<void>();
  const realRead = f.store.read;
  f.store.read = async () => {
    reading.resolve();
    await release.promise;
    return realRead();
  };
  const hydrate = f.offline.hydrate();
  await reading.promise;
  f.offline.invalidateMemory();
  const cleared = f.offline.clear();
  release.resolve();
  await hydrate;
  await cleared;
  assert.equal(f.offline.getSnapshot().status, 'none');
  assert.equal(f.binding(), null);
});

test('logout continues binding/cache cleanup when credential clear throws', async () => {
  const session = credentialFixture();
  await session.boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const offline = offlineFixture({ userId: 'user-a', tenantId: 'tenant-1' });
  await offline.offline.hydrate();
  const cache = memoryTicketCache();
  await cache.write(
    {
      userId: 'user-a',
      tenantId: 'tenant-1',
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticketA],
    },
    cache.gate.current(),
  );
  session.store.clear = async () => {
    throw new Error('Keychain credential delete failed');
  };

  const errors: string[] = [];
  cache.gate.invalidate();
  offline.gate.invalidate();
  offline.offline.invalidateMemory();
  try {
    await session.boundary.logout();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    await offline.offline.clear();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    await cache.clear('user-a', 'tenant-1');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  assert.ok(errors.some((message) => /credential delete failed/.test(message)));
  assert.equal(offline.offline.getSnapshot().status, 'none');
  assert.equal(offline.binding(), null);
  assert.equal(await cache.read('user-a', 'tenant-1'), null);
  assert.equal(session.boundary.getSnapshot().status, 'signed-out');
});

test('cold restore unreachable keeps credential; 401 clears; offline getCredential null', async () => {
  const unreachable = credentialFixture('keychain-token');
  assert.equal(
    await unreachable.boundary.restore(async () => CREDENTIAL_UNREACHABLE),
    'unreachable',
  );
  assert.equal(unreachable.credential(), 'keychain-token');
  assert.equal(unreachable.boundary.getSnapshot().status, 'signed-out');
  assert.equal(await unreachable.boundary.getCredential(), null);

  const rejected = credentialFixture('keychain-token');
  assert.equal(await rejected.boundary.restore(async () => null), 'signed-out');
  assert.equal(rejected.credential(), null);
  assert.equal(await rejected.boundary.getCredential(), null);
});

test('no prior offline binding stays none after hydrate (fail closed)', async () => {
  const f = offlineFixture(null);
  await f.offline.hydrate();
  assert.equal(f.offline.getSnapshot().status, 'none');
});

test('late bindAfterOnlineVerify with pre-logout epoch does not resurrect binding', async () => {
  const session = credentialFixture();
  const offline = offlineFixture(null);
  await session.boundary.establish('tok-a', async () => ({ userId: 'user-a' }));
  const epoch = session.boundary.captureEpoch();
  assert.ok(epoch);
  assert.equal(session.boundary.isEpochCurrent(epoch), true);
  await session.boundary.load('tenant-1', 'me-tickets', async () => [ticketA]);
  const bindingEpoch = offline.gate.current();

  offline.gate.invalidate();
  offline.offline.invalidateMemory();
  await session.boundary.logout();
  await offline.offline.clear();
  assert.equal(offline.binding(), null);

  // Must pass the pre-logout epoch — default gate.current() would resurrect.
  const resurrected = await offline.offline.bindAfterOnlineVerify(
    'user-a',
    'tenant-1',
    bindingEpoch,
  );
  assert.equal(resurrected, false);
  assert.equal(offline.binding(), null);
  assert.equal(offline.offline.getSnapshot().status, 'none');
});
