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
import type { StaffGateScope } from './staff-gate-events.ts';
import { isMembershipAuthzDenial } from '../identity/staff-eligibility.ts';
import { randomId } from '../lib/random-id.ts';

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

export const EMPTY_OFFLINE_QUEUE_SNAPSHOT: OfflineQueueSnapshot = {
  items: [],
  pendingCount: 0,
  conflictCount: 0,
  syncing: false,
  lastSyncError: null,
};

export class OfflineScanQueue {
  private items: QueuedOfflineScan[] = [];
  private deviceId: string | null = null;
  private seqMap: Record<string, number> = {};
  private syncing = false;
  private lastSyncError: string | null = null;
  private hydrated = false;
  private ownerUserId: string | null = null;
  /** Bumps on bind/invalidate — fences late hydrate / in-memory apply. */
  private bindGeneration = 0;
  /** Bumps on clearForUser — fences late durable enqueue writes after logout. */
  private writeGeneration = 0;
  /**
   * Per-user writeGeneration of the last successful durable persist.
   * Stale rollbacks must not clear partitions that a newer session already
   * committed after logout/re-login.
   */
  private lastSuccessfulWriteGeneration = new Map<string, number>();
  private listeners = new Set<() => void>();
  private snapshot: OfflineQueueSnapshot = EMPTY_OFFLINE_QUEUE_SNAPSHOT;
  private store: OfflineQueueStore;
  private createId: () => string;
  private nowIso: () => string;

  constructor(
    store: OfflineQueueStore,
    opts?: { createId?: () => string; nowIso?: () => string },
  ) {
    this.store = store;
    // Hermes: no global crypto — same #608 footgun as runScan default createId.
    this.createId = opts?.createId ?? randomId;
    this.nowIso = opts?.nowIso ?? (() => new Date().toISOString());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Stable reference for useSyncExternalStore — rebuilt only on emit. */
  getSnapshot = (): OfflineQueueSnapshot => this.snapshot;

  private rebuildSnapshot(): void {
    const pendingCount = this.items.filter(
      (i) => i.localStatus === 'pending' || i.localStatus === 'syncing',
    ).length;
    const conflictCount = this.items.filter(
      (i) => i.localStatus === 'conflict' || i.localStatus === 'rejected',
    ).length;
    this.snapshot = {
      items: this.items,
      pendingCount,
      conflictCount,
      syncing: this.syncing,
      lastSyncError: this.lastSyncError,
    };
  }

  private emit() {
    this.rebuildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private isBindCurrent(bindGeneration: number, userId: string): boolean {
    return (
      bindGeneration === this.bindGeneration && this.ownerUserId === userId
    );
  }

  private isWriteCurrent(writeGeneration: number): boolean {
    return writeGeneration === this.writeGeneration;
  }

  private markSuccessfulWrite(userId: string, writeGeneration: number): void {
    this.lastSuccessfulWriteGeneration.set(userId, writeGeneration);
  }

  /**
   * Undo a late durable write that lost the clear/logout race — but only when
   * no newer session has successfully persisted to this partition. If a newer
   * writeGeneration already committed, repair durable state from current memory
   * when we still own the user (late write may have clobbered seq/queue).
   */
  private async rollbackStaleDurableWrite(
    userId: string,
    staleWriteGeneration: number,
  ): Promise<void> {
    const lastOk = this.lastSuccessfulWriteGeneration.get(userId);
    if (
      lastOk !== undefined &&
      lastOk === this.writeGeneration &&
      this.writeGeneration > staleWriteGeneration
    ) {
      if (
        this.ownerUserId === userId &&
        this.isWriteCurrent(this.writeGeneration)
      ) {
        await this.store.writeSeqMap(userId, this.seqMap);
        await this.store.writeQueue(userId, this.items);
      }
      return;
    }
    await this.store.clearQueue(userId);
    await this.store.clearSeqMap(userId);
  }

  ownerUserIdOrNull(): string | null {
    return this.ownerUserId;
  }

  /**
   * Bind the in-memory queue to a verified user partition and hydrate that
   * user's durable SecureStore keys. Switching users fail-closes memory first.
   */
  async bindUser(userId: string): Promise<void> {
    if (!userId) {
      this.invalidateMemory();
      return;
    }
    if (this.ownerUserId === userId && this.hydrated) return;
    if (this.ownerUserId !== userId) {
      this.resetMemoryKeepingListeners();
    } else {
      // Same user, overlapping hydrate — cancel the in-flight one.
      this.bindGeneration += 1;
      this.hydrated = false;
    }
    this.ownerUserId = userId;
    this.hydrated = false;
    await this.hydrate();
  }

  /** Immediate fail-closed memory clear (does not touch durable store). */
  invalidateMemory(): void {
    this.resetMemoryKeepingListeners();
    this.emit();
  }

  private resetMemoryKeepingListeners(): void {
    this.bindGeneration += 1;
    this.items = [];
    this.seqMap = {};
    this.syncing = false;
    this.lastSyncError = null;
    this.ownerUserId = null;
    this.hydrated = false;
    // deviceId stays — physical device identity is not user-scoped.
  }

  /**
   * Clear memory + durable queue/seq for a user (logout / account switch).
   * Safe when owner is already null — still deletes that user's SecureStore keys.
   * Bumps writeGeneration first so in-flight enqueue cannot resurrect durable rows.
   */
  async clearForUser(userId: string): Promise<void> {
    if (!userId) return;
    this.fenceForUser(userId);
    await this.store.clearQueue(userId);
    await this.store.clearSeqMap(userId);
  }

  /** Install the logout generation fence before durable journal I/O. */
  fenceForUser(userId: string): void {
    if (!userId) return;
    this.writeGeneration += 1;
    this.lastSuccessfulWriteGeneration.delete(userId);
    if (this.ownerUserId === userId || this.ownerUserId === null) {
      this.resetMemoryKeepingListeners();
      this.emit();
    }
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const userId = this.ownerUserId;
    const bindGeneration = this.bindGeneration;
    if (!userId) {
      this.items = [];
      this.seqMap = {};
      this.hydrated = false;
      this.emit();
      return;
    }
    const raw = await this.store.readQueue(userId);
    if (!this.isBindCurrent(bindGeneration, userId)) return;
    const items = raw.map((row) => ({
      ...row,
      type: 'CHECKIN_OFFLINE' as const,
      payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
      localStatus: normalizeLocalStatus(row.localStatus),
    }));
    const deviceId = await this.store.readDeviceId();
    if (!this.isBindCurrent(bindGeneration, userId)) return;
    const seqMap = await this.store.readSeqMap(userId);
    if (!this.isBindCurrent(bindGeneration, userId)) return;

    this.items = items;
    this.seqMap = seqMap;
    this.deviceId = deviceId;
    if (!this.deviceId) {
      const created = this.createId();
      await this.store.writeDeviceId(created);
      if (!this.isBindCurrent(bindGeneration, userId)) return;
      this.deviceId = created;
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
    // Capture owner/generation BEFORE any await so a mid-flight bind switch
    // cannot re-attribute this scan to a different partition.
    const userId = this.ownerUserId;
    const bindGeneration = this.bindGeneration;
    const writeGeneration = this.writeGeneration;
    if (!userId) {
      throw new Error(
        'Offline queue chưa gắn user — đăng nhập staff trước khi xếp hàng offline.',
      );
    }
    await this.hydrate();
    if (
      !this.isBindCurrent(bindGeneration, userId) ||
      !this.isWriteCurrent(writeGeneration)
    ) {
      throw new Error(
        'Hàng đợi offline đã bị hủy (đổi user/đăng xuất) — không xếp hàng.',
      );
    }
    const deviceId = await this.ensureDeviceId();
    if (
      !this.isBindCurrent(bindGeneration, userId) ||
      !this.isWriteCurrent(writeGeneration)
    ) {
      throw new Error(
        'Hàng đợi offline đã bị hủy (đổi user/đăng xuất) — không xếp hàng.',
      );
    }
    const key = seqKey(deviceId, input.staffSessionId);
    const nextSeq = (this.seqMap[key] ?? -1) + 1;
    const nextSeqMap = { ...this.seqMap, [key]: nextSeq };
    await this.store.writeSeqMap(userId, nextSeqMap);
    if (!this.isWriteCurrent(writeGeneration)) {
      await this.rollbackStaleDurableWrite(userId, writeGeneration);
      throw new Error(
        'Hàng đợi offline đã bị hủy (đăng xuất) — không xếp hàng.',
      );
    }
    if (!this.isBindCurrent(bindGeneration, userId)) {
      throw new Error(
        'Hàng đợi offline đã bị hủy (đổi user) — không xếp hàng.',
      );
    }
    this.seqMap = nextSeqMap;

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
    const persisted = await this.persistTrimmed(
      userId,
      bindGeneration,
      writeGeneration,
    );
    if (!persisted) {
      throw new Error(
        'Hàng đợi offline đã bị hủy (đổi user/đăng xuất) — không xếp hàng.',
      );
    }
    this.markSuccessfulWrite(userId, writeGeneration);
    this.emit();
    return item;
  }

  /**
   * Persist trimmed queue for a captured userId.
   * Late writes after clearForUser are rolled back; bind-switch leaves the
   * prior user's partition intact and does not mutate the new owner's memory.
   */
  private async persistTrimmed(
    userId: string,
    bindGeneration: number,
    writeGeneration: number,
  ): Promise<boolean> {
    if (!userId) return false;
    if (!this.isWriteCurrent(writeGeneration)) return false;
    if (!this.isBindCurrent(bindGeneration, userId)) return false;
    const pending = this.items.filter(
      (i) => i.localStatus === 'pending' || i.localStatus === 'syncing',
    );
    const settled = this.items
      .filter(
        (i) =>
          i.localStatus !== 'pending' && i.localStatus !== 'syncing',
      )
      .slice(0, RETAIN_SETTLED);
    const nextItems = [...pending, ...settled];
    await this.store.writeQueue(userId, nextItems);
    if (!this.isWriteCurrent(writeGeneration)) {
      await this.rollbackStaleDurableWrite(userId, writeGeneration);
      return false;
    }
    if (!this.isBindCurrent(bindGeneration, userId)) {
      return false;
    }
    this.items = nextItems;
    this.markSuccessfulWrite(userId, writeGeneration);
    return true;
  }

  /**
   * Replay pending events grouped by eventId (path) then tenant/session batch.
   * Uses contract batch max and replay order.
   */
  async replay(input: {
    bearer: string;
    apiBase: string;
    fetchImpl?: typeof fetch;
    shouldContinue?: () => boolean;
  }): Promise<{
    flushed: number;
    results: OfflineSyncItemResult[];
    authzDenial?: { status: number; code?: string };
  }> {
    await this.hydrate();
    const ownerUserId = this.ownerUserId;
    const bindGeneration = this.bindGeneration;
    const writeGeneration = this.writeGeneration;
    if (!ownerUserId) {
      return { flushed: 0, results: [] };
    }
    if (input.shouldContinue && !input.shouldContinue()) return { flushed: 0, results: [] };
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
    if (
      !this.isBindCurrent(bindGeneration, ownerUserId) ||
      !this.isWriteCurrent(writeGeneration)
    ) {
      this.syncing = false;
      this.emit();
      return { flushed: 0, results: [] };
    }
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
        if (
          !this.isBindCurrent(bindGeneration, ownerUserId) ||
          !this.isWriteCurrent(writeGeneration)
        ) {
          return { flushed, results: allResults };
        }
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
            if (
              !this.isBindCurrent(bindGeneration, ownerUserId) ||
              !this.isWriteCurrent(writeGeneration)
            ) {
              return { flushed, results: allResults };
            }
            const chunk = sorted.slice(i, i + OFFLINE_SYNC_MAX_BATCH);
            if (input.shouldContinue && !input.shouldContinue()) return { flushed, results: allResults };
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

            if (input.shouldContinue && !input.shouldContinue()) {
              this.items = this.items.map((row) => ids.has(row.clientEventId) ? { ...row, localStatus: 'pending' as const } : row);
              return { flushed, results: allResults };
            }

            const outcome = await postOfflineSync({
              fetchImpl,
              url: `${base}${offlineSyncPath(eventId)}`,
              bearer: input.bearer,
              body,
            });
            const authzDenial =
              outcome.kind === 'batch_error' &&
              isMembershipAuthzDenial(outcome.status, { code: outcome.code })
                ? { status: outcome.status, code: outcome.code }
                : null;

            if (input.shouldContinue && !input.shouldContinue()) {
              this.items = this.items.map((row) => ids.has(row.clientEventId) ? { ...row, localStatus: 'pending' as const } : row);
              return {
                flushed,
                results: allResults,
                ...(authzDenial ? { authzDenial } : {}),
              };
            }

            if (
              !this.isBindCurrent(bindGeneration, ownerUserId) ||
              !this.isWriteCurrent(writeGeneration)
            ) {
              return { flushed, results: allResults };
            }

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
              await this.persistTrimmed(
                ownerUserId,
                bindGeneration,
                writeGeneration,
              );
              return { flushed, results: allResults };
            }

            if (outcome.kind === 'batch_error') {
              if (authzDenial) {
                // Membership denial is not a ticket outcome. Keep every row
                // available for a later authorized replay, and stop this batch.
                const message = 'Quyền nhân viên đã đổi. Giữ hàng đợi — cần xác minh lại quyền trước khi đồng bộ.';
                this.items = this.items.map((row) =>
                  ids.has(row.clientEventId)
                    ? { ...row, localStatus: 'pending' as const, lastMessage: message }
                    : row,
                );
                this.lastSyncError = message;
                // Durable rows were already pending before POST. Return the
                // denial even if SecureStore cannot accept another write.
                return {
                  flushed,
                  results: allResults,
                  authzDenial,
                };
              }
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
              await this.persistTrimmed(
                ownerUserId,
                bindGeneration,
                writeGeneration,
              );
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
            await this.persistTrimmed(
              ownerUserId,
              bindGeneration,
              writeGeneration,
            );
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
  if (input.conflictCount > 0) {
    return {
      title: 'Có xung đột đồng bộ',
      body: `${input.conflictCount} mục bị từ chối/xung đột. Mở tab Lịch sử của sự kiện này để xem chi tiết — không cho vào theo bản thua.`,
      tone: 'deny',
    };
  }
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
      body: 'Kết nối ổn. Hàng đợi offline trống — chỉ cho vào khi kết quả quét ghi nhận check-in.',
      // Not admit green: connectivity ≠ admission (PD Gate composition).
      tone: 'default',
    };
  }
  return {
    title: 'Trạng thái mạng chưa rõ',
    body: 'Chưa xác nhận được kết nối máy chủ.',
    tone: 'default',
  };
}

/** The sticky sits under one event name; its conflict count must use that event. */
export function offlineConflictBannerForScope(
  snapshot: OfflineQueueSnapshot,
  scope: Pick<StaffGateScope, 'tenantId' | 'eventId'> | null,
  connectivity: ConnectivityState,
): ReturnType<typeof offlineBannerCopy> | null {
  if (!scope) return null;
  const conflictCount = snapshot.items.filter(
    (item) =>
      item.tenantId === scope.tenantId &&
      item.eventId === scope.eventId &&
      (item.localStatus === 'conflict' || item.localStatus === 'rejected'),
  ).length;
  if (conflictCount === 0) return null;
  return offlineBannerCopy({
    connectivity,
    pendingCount: snapshot.pendingCount,
    conflictCount,
    syncing: snapshot.syncing,
    lastSyncError: snapshot.lastSyncError,
  });
}
