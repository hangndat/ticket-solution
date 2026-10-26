import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OfflineScanQueue,
  offlineBannerCopy,
  offlineConflictBannerForScope,
  probeConnectivity,
} from './offline-queue.ts';
import { createMemoryOfflineQueueStore, type StoredOfflineScan } from './offline-queue-types.ts';
import { buildDeviceScanHistory } from './staff-gate-device-history.ts';
import {
  OFFLINE_SYNC_ERROR_CODES,
  compareOfflineReplayOrder,
  offlineConflictMessageVi,
} from './offline-sync-contract.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const staffSessionId = '44444444-4444-4444-8444-444444444444';
const userA = 'user-a';
const userB = 'user-b';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function queueFor(
  store: ReturnType<typeof createMemoryOfflineQueueStore>,
  userId: string,
  opts?: { createId?: () => string; nowIso?: () => string },
): Promise<OfflineScanQueue> {
  const q = new OfflineScanQueue(store, opts);
  await q.bindUser(userId);
  return q;
}

test('persist queue survives re-hydrate (SecureStore-shaped store)', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  const q1 = await queueFor(store, userA, {
    createId: (() => {
      let n = 0;
      return () => {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      };
    })(),
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  await q1.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  assert.equal(q1.getSnapshot().pendingCount, 1);

  const q2 = await queueFor(store, userA);
  assert.equal(q2.getSnapshot().pendingCount, 1);
  assert.equal(q2.getSnapshot().items[0]?.ticketId, ticketId);
  assert.equal(q2.getSnapshot().items[0]?.clientSeq, 0);
});

test('getSnapshot returns stable reference until emit', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  const q = await queueFor(store, userA, {
    createId: () => '00000000-0000-4000-8000-000000000001',
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const a = q.getSnapshot();
  const b = q.getSnapshot();
  assert.equal(a, b);
  await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  const c = q.getSnapshot();
  assert.notEqual(a, c);
  assert.equal(c, q.getSnapshot());
});

test('queue is partitioned by userId; logout clear removes durable rows', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const createId = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  };
  const qa = await queueFor(store, userA, {
    createId,
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  await qa.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  assert.equal(qa.getSnapshot().pendingCount, 1);

  const qb = await queueFor(store, userB, {
    createId,
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  assert.equal(qb.getSnapshot().pendingCount, 0);
  await qb.enqueue({
    ticketId: '55555555-5555-4555-8555-555555555555',
    tenantId,
    eventId,
    staffSessionId,
  });
  assert.equal(qb.getSnapshot().pendingCount, 1);

  await qb.clearForUser(userB);
  assert.equal(qb.getSnapshot().pendingCount, 0);
  assert.equal(qb.ownerUserIdOrNull(), null);

  const qaAgain = await queueFor(store, userA);
  assert.equal(qaAgain.getSnapshot().pendingCount, 1);
  await qaAgain.clearForUser(userA);
  const empty = await queueFor(store, userA);
  assert.equal(empty.getSnapshot().pendingCount, 0);
});

test('clientSeq is monotonic per device+session', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const a = await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  const b = await q.enqueue({
    ticketId: '55555555-5555-4555-8555-555555555555',
    tenantId,
    eventId,
    staffSessionId,
  });
  assert.equal(a.clientSeq, 0);
  assert.equal(b.clientSeq, 1);
});

test('stale replay before POST sends nothing; stale deferred POST cannot settle queue', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  const q = await queueFor(store, userA, {
    createId: () => '00000000-0000-4000-8000-000000000001',
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const item = await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  let fetches = 0;
  const noPost = await q.replay({ bearer: 't', apiBase: 'https://api.example',
    shouldContinue: () => false,
    fetchImpl: async () => { fetches += 1; return jsonResponse(500, {}); },
  });
  assert.equal(noPost.flushed, 0);
  assert.equal(fetches, 0);
  let allow = true;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const replay = q.replay({ bearer: 't', apiBase: 'https://api.example',
    shouldContinue: () => allow,
    fetchImpl: async () => {
      fetches += 1;
      await waiting;
      return jsonResponse(200, { results: [{ clientEventId: item.clientEventId, status: 'APPLIED', checkinId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] });
    },
  });
  while (fetches === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  allow = false;
  release();
  const result = await replay;
  assert.equal(result.flushed, 0);
  assert.equal(q.getSnapshot().items[0]?.localStatus, 'pending');
  const restored = await queueFor(store, userA);
  assert.equal(restored.getSnapshot().items[0]?.localStatus, 'pending');
});

test('replay maps CONFLICT_LOST and keeps ALREADY_CHECKED_IN messaging', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const item = await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });

  const fetchImpl: typeof fetch = async () =>
    jsonResponse(200, {
      serverTime: '2026-10-17T08:00:01.000Z',
      maxClockSkewSeconds: 300,
      results: [
        {
          clientEventId: item.clientEventId,
          status: 'CONFLICT',
          code: OFFLINE_SYNC_ERROR_CODES.CONFLICT_LOST,
          winningCheckinId: '99999999-9999-4999-8999-999999999999',
        },
      ],
    });

  const out = await q.replay({
    bearer: 't',
    apiBase: 'https://api.example',
    fetchImpl,
  });
  assert.equal(out.flushed, 1);
  const snap = q.getSnapshot();
  assert.equal(snap.pendingCount, 0);
  assert.equal(snap.conflictCount, 1);
  assert.match(
    snap.items[0]?.lastMessage ?? '',
    /Xung đột đồng bộ/,
  );
});

test('replay APPLIED clears pending and records checkinId', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const item = await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  const checkinId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await q.replay({
    bearer: 't',
    apiBase: 'https://api.example',
    fetchImpl: async () =>
      jsonResponse(200, {
        serverTime: '2026-10-17T08:00:01.000Z',
        maxClockSkewSeconds: 300,
        results: [
          {
            clientEventId: item.clientEventId,
            status: 'APPLIED',
            checkinId,
          },
        ],
      }),
  });
  assert.equal(q.getSnapshot().pendingCount, 0);
  assert.equal(q.getSnapshot().items[0]?.localStatus, 'applied');
  assert.equal(q.getSnapshot().items[0]?.checkinId, checkinId);
});

test('NOT_IMPLEMENTED keeps pending so queue survives stub BE', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  await q.replay({
    bearer: 't',
    apiBase: 'https://api.example',
    fetchImpl: async () =>
      jsonResponse(501, {
        code: OFFLINE_SYNC_ERROR_CODES.NOT_IMPLEMENTED,
        message: 'stub',
        retryable: false,
        requestId: 'r1',
      }),
  });
  assert.equal(q.getSnapshot().pendingCount, 1);
  assert.match(q.getSnapshot().lastSyncError ?? '', /stub|chưa bật/i);
});

test('network failure during replay keeps pending', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  await q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  await q.replay({
    bearer: 't',
    apiBase: 'https://api.example',
    fetchImpl: async () => {
      throw new TypeError('offline');
    },
  });
  assert.equal(q.getSnapshot().pendingCount, 1);
});

test('VI conflict copy keys off contract codes', () => {
  assert.match(
    offlineConflictMessageVi(OFFLINE_SYNC_ERROR_CODES.ALREADY_CHECKED_IN),
    /đã check-in/i,
  );
  assert.match(
    offlineConflictMessageVi(OFFLINE_SYNC_ERROR_CODES.CLOCK_SKEW_EXCEEDED),
    /300/,
  );
});

test('banner copy is Vietnamese for offline/sync/conflict', () => {
  const offline = offlineBannerCopy({
    connectivity: 'offline',
    pendingCount: 2,
    conflictCount: 0,
    syncing: false,
    lastSyncError: null,
  });
  assert.equal(offline.title, 'Đang ngoại tuyến');
  assert.match(offline.body, /2 lượt/);

  const conflict = offlineBannerCopy({
    connectivity: 'online',
    pendingCount: 0,
    conflictCount: 1,
    syncing: false,
    lastSyncError: null,
  });
  assert.equal(conflict.title, 'Có xung đột đồng bộ');
  assert.equal(conflict.tone, 'deny');
  assert.match(conflict.body, /tab Lịch sử của sự kiện này/);
  assert.doesNotMatch(conflict.body, /bên dưới/);
  const conflictWhileOffline = offlineBannerCopy({
    connectivity: 'offline',
    pendingCount: 1,
    conflictCount: 1,
    syncing: true,
    lastSyncError: null,
  });
  assert.equal(conflictWhileOffline.title, 'Có xung đột đồng bộ');
  assert.match(conflictWhileOffline.body, /không cho vào/);

  const online = offlineBannerCopy({
    connectivity: 'online',
    pendingCount: 0,
    conflictCount: 0,
    syncing: false,
    lastSyncError: null,
  });
  assert.equal(online.title, 'Trực tuyến');
  assert.notEqual(online.tone, 'admit');
});

test('conflict banner follows tenant and event after offline restart while sync remains device-wide', async () => {
  const eventB = '55555555-5555-4555-8555-555555555555';
  const otherTenant = '66666666-6666-4666-8666-666666666666';
  const base = {
    type: 'CHECKIN_OFFLINE' as const,
    ticketId,
    staffSessionId,
    clientOccurredAt: '2026-10-17T08:00:00.000Z',
    clientSeq: 0,
    payloadVersion: 1 as const,
  };
  const rows: StoredOfflineScan[] = [
    { ...base, clientEventId: 'a-pending', tenantId, eventId, localStatus: 'pending' },
    { ...base, clientEventId: 'b-conflict', tenantId, eventId: eventB, localStatus: 'conflict' },
    { ...base, clientEventId: 'other-tenant-rejected', tenantId: otherTenant, eventId: eventB, localStatus: 'rejected' },
  ];
  const store = createMemoryOfflineQueueStore(rows, userA);
  const eventAScope = { tenantId, eventId, name: 'Sự kiện A' };
  const eventBScope = { tenantId, eventId: eventB, name: 'Sự kiện B' };

  for (let launch = 0; launch < 2; launch += 1) {
    const queue = await queueFor(store, userA);
    const snapshot = queue.getSnapshot();
    assert.equal(snapshot.pendingCount, 1);
    assert.equal(snapshot.conflictCount, 2);
    assert.equal(snapshot.pendingCount > 0 || snapshot.conflictCount > 0, true);
    assert.equal(offlineConflictBannerForScope(snapshot, eventAScope, 'offline'), null);
    assert.equal(offlineConflictBannerForScope(snapshot, null, 'offline'), null);
    const bannerB = offlineConflictBannerForScope(snapshot, eventBScope, 'offline');
    assert.equal(bannerB?.title, 'Có xung đột đồng bộ');
    assert.match(bannerB?.body ?? '', /^1 mục .*tab Lịch sử của sự kiện này/);
    assert.equal(buildDeviceScanHistory(eventAScope, [], snapshot.items).length, 1);
    const historyB = buildDeviceScanHistory(eventBScope, [], snapshot.items);
    assert.equal(historyB.length, 1);
    assert.equal(historyB[0]?.id, 'b-conflict');
    assert.equal(offlineConflictBannerForScope(snapshot, eventAScope, 'offline'), null);
  }
});

test('probeConnectivity treats fetch throw as offline', async () => {
  const state = await probeConnectivity('https://api.example', async () => {
    throw new TypeError('network');
  });
  assert.equal(state, 'offline');
});

test('replay order comparator matches contract', () => {
  const a = {
    clientOccurredAt: '2026-10-17T08:00:00.000Z',
    clientSeq: 1,
    clientEventId: 'b',
  };
  const b = {
    clientOccurredAt: '2026-10-17T08:00:00.000Z',
    clientSeq: 0,
    clientEventId: 'a',
  };
  assert.ok(compareOfflineReplayOrder(b, a) < 0);
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('late hydrate for user A after bind B does not apply A tickets or replay under B', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const createId = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  };
  const seed = await queueFor(store, userA, {
    createId,
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  await seed.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  assert.equal(seed.getSnapshot().pendingCount, 1);

  const reading = deferred<void>();
  const release = deferred<void>();
  const realRead = store.readQueue.bind(store);
  store.readQueue = async (id) => {
    if (id === userA) {
      reading.resolve();
      await release.promise;
    }
    return realRead(id);
  };

  const q = new OfflineScanQueue(store, {
    createId,
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const bindA = q.bindUser(userA);
  await reading.promise;
  await q.bindUser(userB);
  release.resolve();
  await bindA;

  assert.equal(q.ownerUserIdOrNull(), userB);
  assert.equal(q.getSnapshot().pendingCount, 0);
  assert.equal(
    q.getSnapshot().items.some((i) => i.ticketId === ticketId),
    false,
  );

  const fetchCalls: string[] = [];
  await q.replay({
    bearer: 'bearer-b',
    apiBase: 'https://api.example',
    fetchImpl: async (input) => {
      fetchCalls.push(String(input));
      return jsonResponse(200, {
        serverTime: '2026-10-17T08:00:01.000Z',
        maxClockSkewSeconds: 300,
        results: [],
      });
    },
  });
  assert.equal(fetchCalls.length, 0);
  assert.equal(q.getSnapshot().pendingCount, 0);
});

test('late enqueue write after clearForUser does not restore durable queue', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });

  const writing = deferred<void>();
  const release = deferred<void>();
  const realWrite = store.writeQueue.bind(store);
  store.writeQueue = async (id, items) => {
    writing.resolve();
    await release.promise;
    return realWrite(id, items);
  };

  const pending = q.enqueue({ ticketId, tenantId, eventId, staffSessionId });
  await writing.promise;
  await q.clearForUser(userA);
  release.resolve();

  await assert.rejects(pending, /đăng xuất|đổi user|hủy/i);
  assert.equal(q.ownerUserIdOrNull(), null);
  assert.equal(q.getSnapshot().pendingCount, 0);
  assert.deepEqual(await store.readQueue(userA), []);
  assert.deepEqual(await store.readSeqMap(userA), {});
});

test('enqueue started under A must not write A scan into B partition after delayed hydrate', async () => {
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const createId = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  };
  const reading = deferred<void>();
  const release = deferred<void>();
  const realRead = store.readQueue.bind(store);
  store.readQueue = async (id) => {
    if (id === userA) {
      reading.resolve();
      await release.promise;
    }
    return realRead(id);
  };
  const q = new OfflineScanQueue(store, {
    createId,
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const bindA = q.bindUser(userA);
  await reading.promise;
  const enqueueA = q
    .enqueue({ ticketId, tenantId, eventId, staffSessionId })
    .then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );
  await q.bindUser(userB);
  release.resolve();
  await bindA;
  const result = await enqueueA;
  assert.equal(result, 'rejected');
  assert.deepEqual(await store.readQueue(userB), []);
  assert.equal(
    (await store.readQueue(userA)).some((row) => row.ticketId === ticketId),
    false,
  );
});

test('stale pre-logout enqueue rollback must preserve successful new-session enqueue', async () => {
  const store = createMemoryOfflineQueueStore([], userA);
  let n = 0;
  const q = await queueFor(store, userA, {
    createId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    nowIso: () => '2026-10-17T08:00:00.000Z',
  });
  const writing = deferred<void>();
  const release = deferred<void>();
  const realWriteSeq = store.writeSeqMap.bind(store);
  let first = true;
  store.writeSeqMap = async (id, map) => {
    if (first) {
      first = false;
      writing.resolve();
      await release.promise;
    }
    return realWriteSeq(id, map);
  };
  const oldEnqueue = q
    .enqueue({ ticketId, tenantId, eventId, staffSessionId })
    .then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );
  await writing.promise;
  await q.clearForUser(userA);
  await q.bindUser(userA);
  const newItem = await q.enqueue({
    ticketId: '55555555-5555-4555-8555-555555555555',
    tenantId,
    eventId,
    staffSessionId,
  });
  assert.equal((await store.readQueue(userA)).length, 1);
  release.resolve();
  assert.equal(await oldEnqueue, 'rejected');
  const durable = await store.readQueue(userA);
  assert.equal(
    durable.some((row) => row.clientEventId === newItem.clientEventId),
    true,
  );
  assert.equal(q.getSnapshot().pendingCount, 1);
});
