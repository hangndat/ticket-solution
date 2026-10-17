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

export type OfflineQueueStore = {
  readQueue(): Promise<StoredOfflineScan[]>;
  writeQueue(items: readonly StoredOfflineScan[]): Promise<void>;
  readDeviceId(): Promise<string | null>;
  writeDeviceId(id: string): Promise<void>;
  readSeqMap(): Promise<Record<string, number>>;
  writeSeqMap(map: Record<string, number>): Promise<void>;
};

/** In-memory store for unit tests (no expo-secure-store import). */
export function createMemoryOfflineQueueStore(
  seed: StoredOfflineScan[] = [],
): OfflineQueueStore {
  let queue = [...seed];
  let deviceId: string | null = null;
  let seqMap: Record<string, number> = {};
  return {
    async readQueue() {
      return [...queue];
    },
    async writeQueue(items) {
      queue = [...items];
    },
    async readDeviceId() {
      return deviceId;
    },
    async writeDeviceId(id) {
      deviceId = id;
    },
    async readSeqMap() {
      return { ...seqMap };
    },
    async writeSeqMap(map) {
      seqMap = { ...map };
    },
  };
}
