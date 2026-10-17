/** Persistable offline scan row (SecureStore JSON). */
export type StoredOfflineScan = {
  clientEventId: string;
  type: 'CHECKIN_OFFLINE';
  eventId: string;
  ticketId: string;
  tenantId: string;
  staffSessionId: string;
  clientOccurredAt: string;
  clientSeq: number;
  payloadVersion: 1;
  localStatus: string;
  lastCode?: string;
  lastMessage?: string;
  checkinId?: string;
  winningCheckinId?: string;
  winningDeviceId?: string;
};

/**
 * Durable store for the offline scan queue.
 * Queue + seq map are partitioned by verified userId; deviceId is device-global.
 */
export type OfflineQueueStore = {
  readQueue(userId: string): Promise<StoredOfflineScan[]>;
  writeQueue(userId: string, items: readonly StoredOfflineScan[]): Promise<void>;
  clearQueue(userId: string): Promise<void>;
  readDeviceId(): Promise<string | null>;
  writeDeviceId(id: string): Promise<void>;
  readSeqMap(userId: string): Promise<Record<string, number>>;
  writeSeqMap(userId: string, map: Record<string, number>): Promise<void>;
  clearSeqMap(userId: string): Promise<void>;
};

/** In-memory store for unit tests (no expo-secure-store import). */
export function createMemoryOfflineQueueStore(
  seed: StoredOfflineScan[] = [],
  seedUserId = 'user-test',
): OfflineQueueStore {
  const queues = new Map<string, StoredOfflineScan[]>([
    [seedUserId, [...seed]],
  ]);
  let deviceId: string | null = null;
  const seqMaps = new Map<string, Record<string, number>>();
  return {
    async readQueue(userId) {
      return [...(queues.get(userId) ?? [])];
    },
    async writeQueue(userId, items) {
      queues.set(userId, [...items]);
    },
    async clearQueue(userId) {
      queues.delete(userId);
    },
    async readDeviceId() {
      return deviceId;
    },
    async writeDeviceId(id) {
      deviceId = id;
    },
    async readSeqMap(userId) {
      return { ...(seqMaps.get(userId) ?? {}) };
    },
    async writeSeqMap(userId, map) {
      seqMaps.set(userId, { ...map });
    },
    async clearSeqMap(userId) {
      seqMaps.delete(userId);
    },
  };
}
