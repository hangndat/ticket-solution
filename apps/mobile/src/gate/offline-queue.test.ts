import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OfflineScanQueue,
  offlineBannerCopy,
  probeConnectivity,
} from './offline-queue.ts';
import { createMemoryOfflineQueueStore } from './offline-queue-types.ts';
import {
  OFFLINE_SYNC_ERROR_CODES,
  compareOfflineReplayOrder,
  offlineConflictMessageVi,
} from './offline-sync-contract.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const staffSessionId = '44444444-4444-4444-8444-444444444444';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('persist queue survives re-hydrate (SecureStore-shaped store)', async () => {
  const store = createMemoryOfflineQueueStore();
  const q1 = new OfflineScanQueue(store, {
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

  const q2 = new OfflineScanQueue(store);
  await q2.hydrate();
  assert.equal(q2.getSnapshot().pendingCount, 1);
  assert.equal(q2.getSnapshot().items[0]?.ticketId, ticketId);
  assert.equal(q2.getSnapshot().items[0]?.clientSeq, 0);
});

test('clientSeq is monotonic per device+session', async () => {
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const q = new OfflineScanQueue(store, {
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

test('replay maps CONFLICT_LOST and keeps ALREADY_CHECKED_IN messaging', async () => {
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const q = new OfflineScanQueue(store, {
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
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const q = new OfflineScanQueue(store, {
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
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const q = new OfflineScanQueue(store, {
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
  const store = createMemoryOfflineQueueStore();
  let n = 0;
  const q = new OfflineScanQueue(store, {
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
