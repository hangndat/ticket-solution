import {
  OFFLINE_SYNC_ERROR_CODES,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_PAYLOAD_VERSION,
  compareOfflineReplayOrder,
  offlineConflictMessageVi,
  offlineSyncPath,
  type OfflineSyncEvent,
  type OfflineSyncItemResult,
  type OfflineSyncRequestBody,
  type OfflineSyncResponse,
} from './offline-sync-contract.ts';
import type { OfflineQueueStore } from './offline-queue-types.ts';

export type OfflineLocalStatus =
  | 'pending'
  | 'syncing'
  | 'applied'
  | 'duplicate'
  | 'rejected'
  | 'conflict';

export type QueuedOfflineScan = {
  clientEventId: string;
  type: 'CHECKIN_OFFLINE';
  eventId: string;
  ticketId: string;
  tenantId: string;
  staffSessionId: string;
  clientOccurredAt: string;
  clientSeq: number;
  payloadVersion: typeof OFFLINE_SYNC_PAYLOAD_VERSION;
  localStatus: OfflineLocalStatus;
  lastCode?: string;
  lastMessage?: string;
  checkinId?: string;
  winningCheckinId?: string;
  winningDeviceId?: string;
};

export type OfflineQueueSnapshot = {
  items: QueuedOfflineScan[];
  pendingCount: number;
  conflictCount: number;
  syncing: boolean;
  lastSyncError: string | null;
};

export type ConnectivityState = 'online' | 'offline' | 'unknown';

const RETAIN_SETTLED = 40;

function seqKey(deviceId: string, staffSessionId: string): string {
  return `${deviceId}::${staffSessionId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function normalizeLocalStatus(value: string): OfflineLocalStatus {
  switch (value) {
    case 'pending':
    case 'syncing':
    case 'applied':
    case 'duplicate':
    case 'rejected':
    case 'conflict':
      return value;
    default:
      return 'pending';
  }
}

function toTransportEvent(item: QueuedOfflineScan): OfflineSyncEvent {
  return {
    clientEventId: item.clientEventId,
    type: 'CHECKIN_OFFLINE',
    eventId: item.eventId,
    ticketId: item.ticketId,
    clientOccurredAt: item.clientOccurredAt,
    clientSeq: item.clientSeq,
    payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
  };
}

function applyItemResult(
  item: QueuedOfflineScan,
  result: OfflineSyncItemResult,
): QueuedOfflineScan {
  const code = typeof result.code === 'string' ? result.code : undefined;
  const vi = offlineConflictMessageVi(code, result.message);
  if (result.status === 'APPLIED') {
    return {
      ...item,
      localStatus: 'applied',
      checkinId:
        typeof result.checkinId === 'string' ? result.checkinId : item.checkinId,
      lastCode: code,
      lastMessage: 'Đã đồng bộ. Check-in được máy chủ ghi nhận.',
    };
  }
  if (result.status === 'DUPLICATE') {
    return {
      ...item,
      localStatus: 'duplicate',
      checkinId:
        typeof result.checkinId === 'string' ? result.checkinId : item.checkinId,
      lastCode: code,
      lastMessage: 'Trùng sự kiện offline — máy chủ đã áp dụng trước đó.',
    };
  }
  if (result.status === 'CONFLICT') {
    return {
      ...item,
      localStatus: 'conflict',
      lastCode: code,
      lastMessage: vi,
      winningCheckinId: result.winningCheckinId,
      winningDeviceId: result.winningDeviceId,
    };
  }
  return {
    ...item,
    localStatus: 'rejected',
    lastCode: code,
    lastMessage: vi,
  };
}

export class OfflineScanQueue {
  private items: QueuedOfflineScan[] = [];
  private deviceId: string | null = null;
  private seqMap: Record<string, number> = {};
  private syncing = false;
  private lastSyncError: string | null = null;
  private hydrated = false;
  private generation = 0;
  private listeners = new Set<() => void>();
  private store: OfflineQueueStore;
  private createId: () => string;
  private nowIso: () => string;

  constructor(
    store: OfflineQueueStore,
    opts?: { createId?: () => string; nowIso?: () => string },
  ) {
    this.store = store;
    this.createId = opts?.createId ?? (() => crypto.randomUUID());
    this.nowIso = opts?.nowIso ?? (() => new Date().toISOString());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): OfflineQueueSnapshot => {
    const pendingCount = this.items.filter(
      (i) => i.localStatus === 'pending' || i.localStatus === 'syncing',
    ).length;
    const conflictCount = this.items.filter(
      (i) => i.localStatus === 'conflict' || i.localStatus === 'rejected',
    ).length;
    return {
      items: this.items,
      pendingCount,
      conflictCount,
      syncing: this.syncing,
      lastSyncError: this.lastSyncError,
    };
  };

  private emit() {
    this.generation += 1;
    for (const listener of this.listeners) listener();
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const raw = await this.store.readQueue();
    this.items = raw.map((row) => ({
      ...row,
      type: 'CHECKIN_OFFLINE' as const,
      payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
      localStatus: normalizeLocalStatus(row.localStatus),
    }));
    this.deviceId = await this.store.readDeviceId();
    this.seqMap = await this.store.readSeqMap();
    if (!this.deviceId) {
      this.deviceId = this.createId();
      await this.store.writeDeviceId(this.deviceId);
    }
    this.hydrated = true;
    this.emit();
  }

  async ensureDeviceId(): Promise<string> {
    await this.hydrate();
    if (!this.deviceId) {
      this.deviceId = this.createId();
      await this.store.writeDeviceId(this.deviceId);
    }
    return this.deviceId;
  }

  pendingItems(): QueuedOfflineScan[] {
    return this.items
      .filter((i) => i.localStatus === 'pending')
      .slice()
      .sort(compareOfflineReplayOrder);
  }

  /**
   * Enqueue a local CHECKIN_OFFLINE scan. Requires an existing staff session
   * (opened while online). Never marks admission — server must apply on sync.
   */
  async enqueue(input: {
    ticketId: string;
    tenantId: string;
    eventId: string;
    staffSessionId: string;
  }): Promise<QueuedOfflineScan> {
    await this.hydrate();
    const deviceId = await this.ensureDeviceId();
    const key = seqKey(deviceId, input.staffSessionId);
    const nextSeq = (this.seqMap[key] ?? -1) + 1;
    this.seqMap = { ...this.seqMap, [key]: nextSeq };
    await this.store.writeSeqMap(this.seqMap);

    const item: QueuedOfflineScan = {
      clientEventId: this.createId(),
      type: 'CHECKIN_OFFLINE',
      eventId: input.eventId,
      ticketId: input.ticketId,
      tenantId: input.tenantId,
      staffSessionId: input.staffSessionId,
      clientOccurredAt: this.nowIso(),
      clientSeq: nextSeq,
      payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
      localStatus: 'pending',
      lastMessage:
        'Đã xếp hàng offline. Chưa cho vào — chờ đồng bộ khi có mạng.',
    };
    this.items = [item, ...this.items];
    await this.persistTrimmed();
    this.emit();
    return item;
  }

  private async persistTrimmed(): Promise<void> {
    const pending = this.items.filter(
      (i) => i.localStatus === 'pending' || i.localStatus === 'syncing',
    );
    const settled = this.items
      .filter(
        (i) =>
          i.localStatus !== 'pending' && i.localStatus !== 'syncing',
      )
      .slice(0, RETAIN_SETTLED);
    this.items = [...pending, ...settled];
    await this.store.writeQueue(this.items);
  }

  /**
   * Replay pending events grouped by eventId (path) then tenant/session batch.
   * Uses contract batch max and replay order.
   */
  async replay(input: {
    bearer: string;
    apiBase: string;
    fetchImpl?: typeof fetch;
  }): Promise<{ flushed: number; results: OfflineSyncItemResult[] }> {
    await this.hydrate();
    if (this.syncing) {
      return { flushed: 0, results: [] };
    }
    const pending = this.pendingItems();
    if (pending.length === 0) {
      this.lastSyncError = null;
      this.emit();
      return { flushed: 0, results: [] };
    }

    this.syncing = true;
    this.lastSyncError = null;
    this.emit();

    const fetchImpl = input.fetchImpl ?? fetch;
    const base = input.apiBase.replace(/\/$/, '');
    const deviceId = await this.ensureDeviceId();
    const allResults: OfflineSyncItemResult[] = [];
    let flushed = 0;

    try {
      const byEvent = new Map<string, QueuedOfflineScan[]>();
      for (const item of pending) {
        const list = byEvent.get(item.eventId) ?? [];
        list.push(item);
        byEvent.set(item.eventId, list);
      }

      for (const [eventId, eventItems] of byEvent) {
        const bySession = new Map<string, QueuedOfflineScan[]>();
        for (const item of eventItems) {
          const sk = `${item.tenantId}::${item.staffSessionId}`;
          const list = bySession.get(sk) ?? [];
          list.push(item);
          bySession.set(sk, list);
        }

        for (const group of bySession.values()) {
          const sorted = group.slice().sort(compareOfflineReplayOrder);
          for (let i = 0; i < sorted.length; i += OFFLINE_SYNC_MAX_BATCH) {
            const chunk = sorted.slice(i, i + OFFLINE_SYNC_MAX_BATCH);
            const ids = new Set(chunk.map((c) => c.clientEventId));
            this.items = this.items.map((row) =>
              ids.has(row.clientEventId)
                ? { ...row, localStatus: 'syncing' as const }
                : row,
            );
            this.emit();

            const head = chunk[0]!;
            const body: OfflineSyncRequestBody = {
              tenantId: head.tenantId,
              staffSessionId: head.staffSessionId,
              deviceId,
              clientClockAt: this.nowIso(),
              events: chunk.map(toTransportEvent),
            };

            const outcome = await postOfflineSync({
              fetchImpl,
              url: `${base}${offlineSyncPath(eventId)}`,
              bearer: input.bearer,
              body,
            });

            if (outcome.kind === 'network') {
              this.items = this.items.map((row) =>
                ids.has(row.clientEventId)
                  ? {
                      ...row,
                      localStatus: 'pending' as const,
                      lastMessage:
                        'Mất mạng khi đồng bộ. Giữ hàng đợi — sẽ thử lại.',
                    }
                  : row,
              );
              this.lastSyncError =
                'Không kết nối được máy chủ khi đồng bộ hàng đợi offline.';
              await this.persistTrimmed();
              return { flushed, results: allResults };
            }

            if (outcome.kind === 'batch_error') {
              const vi = offlineConflictMessageVi(
                outcome.code,
                outcome.message,
              );
              // NOT_IMPLEMENTED / retryable: keep pending so queue survives stub BE.
              const keepPending =
                outcome.code === OFFLINE_SYNC_ERROR_CODES.NOT_IMPLEMENTED ||
                outcome.retryable;
              this.items = this.items.map((row) =>
                ids.has(row.clientEventId)
                  ? {
                      ...row,
                      localStatus: keepPending
                        ? ('pending' as const)
                        : ('rejected' as const),
                      lastCode: outcome.code,
                      lastMessage: vi,
                    }
                  : row,
              );
              this.lastSyncError = vi;
              await this.persistTrimmed();
              if (!keepPending) flushed += chunk.length;
              continue;
            }

            const byId = new Map(
              outcome.response.results.map((r) => [r.clientEventId, r]),
            );
            this.items = this.items.map((row) => {
              if (!ids.has(row.clientEventId)) return row;
              const result = byId.get(row.clientEventId);
              if (!result) {
                return {
                  ...row,
                  localStatus: 'pending' as const,
                  lastMessage:
                    'Thiếu kết quả từng mục từ máy chủ. Giữ trong hàng đợi.',
                };
              }
              allResults.push(result);
              return applyItemResult(row, result);
            });
            flushed += chunk.length;
            await this.persistTrimmed();
          }
        }
      }
    } finally {
      this.syncing = false;
      this.emit();
    }

    return { flushed, results: allResults };
  }
}

type PostOutcome =
  | { kind: 'ok'; response: OfflineSyncResponse }
  | {
      kind: 'batch_error';
      code?: string;
      message?: string;
      retryable: boolean;
      status: number;
    }
  | { kind: 'network' };

async function postOfflineSync(input: {
  fetchImpl: typeof fetch;
  url: string;
  bearer: string;
  body: OfflineSyncRequestBody;
}): Promise<PostOutcome> {
  try {
    const response = await input.fetchImpl(input.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.body),
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    const record = asRecord(json);
    if (response.status >= 200 && response.status < 300 && record) {
      const results = Array.isArray(record.results)
        ? (record.results as OfflineSyncItemResult[])
        : [];
      return {
        kind: 'ok',
        response: {
          serverTime:
            typeof record.serverTime === 'string'
              ? record.serverTime
              : new Date().toISOString(),
          maxClockSkewSeconds:
            typeof record.maxClockSkewSeconds === 'number'
              ? record.maxClockSkewSeconds
              : 300,
          results,
        },
      };
    }
    return {
      kind: 'batch_error',
      code: typeof record?.code === 'string' ? record.code : undefined,
      message: typeof record?.message === 'string' ? record.message : undefined,
      retryable: record?.retryable === true || response.status >= 500,
      status: response.status,
    };
  } catch {
    return { kind: 'network' };
  }
}

export async function probeConnectivity(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectivityState> {
  const base = apiBase.replace(/\/$/, '');
  if (!base) return 'unknown';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetchImpl(`${base}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (res.ok || res.status === 404) return 'online';
      if (res.status >= 500) return 'online';
      return 'online';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'offline';
  }
}

export function offlineBannerCopy(input: {
  connectivity: ConnectivityState;
  pendingCount: number;
  conflictCount: number;
  syncing: boolean;
  lastSyncError: string | null;
}): { title: string; body: string; tone: 'default' | 'unknown' | 'deny' | 'admit' } {
  if (input.connectivity === 'offline') {
    return {
      title: 'Đang ngoại tuyến',
      body:
        input.pendingCount > 0
          ? `Mất mạng. ${input.pendingCount} lượt quét đang chờ trong hàng đợi — chưa cho vào cho đến khi đồng bộ.`
          : 'Mất mạng. Quét mới sẽ được xếp hàng trên máy (cần phiên nhân viên đã mở trước đó).',
      tone: 'unknown',
    };
  }
  if (input.syncing) {
    return {
      title: 'Đang đồng bộ',
      body: `Đang gửi ${input.pendingCount || '…'} lượt offline lên máy chủ…`,
      tone: 'default',
    };
  }
  if (input.conflictCount > 0) {
    return {
      title: 'Có xung đột đồng bộ',
      body: `${input.conflictCount} mục bị từ chối/xung đột. Xem chi tiết bên dưới — không cho vào theo bản thua.`,
      tone: 'deny',
    };
  }
  if (input.pendingCount > 0) {
    return {
      title: 'Chờ đồng bộ',
      body: `${input.pendingCount} lượt offline chưa gửi. Sẽ tự đồng bộ khi có mạng.`,
      tone: 'unknown',
    };
  }
  if (input.lastSyncError) {
    return {
      title: 'Đồng bộ gặp sự cố',
      body: input.lastSyncError,
      tone: 'unknown',
    };
  }
  if (input.connectivity === 'online') {
    return {
      title: 'Trực tuyến',
      body: 'Kết nối ổn. Hàng đợi offline trống.',
      tone: 'admit',
    };
  }
  return {
    title: 'Trạng thái mạng chưa rõ',
    body: 'Chưa xác nhận được kết nối máy chủ.',
    tone: 'default',
  };
}
