import * as SecureStore from 'expo-secure-store';
import type {
  OfflineQueueStore,
  StoredOfflineScan,
} from './offline-queue-types.ts';

export type { OfflineQueueStore, StoredOfflineScan } from './offline-queue-types.ts';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.gate-offline-queue',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const QUEUE_KEY = 'ticket.gate.offline-queue.v1';
const DEVICE_KEY = 'ticket.gate.device-id.v1';
const SEQ_KEY = 'ticket.gate.offline-seq.v1';

function parseQueue(raw: string | null): StoredOfflineScan[] {
  if (!raw) return [];
  try {
    const body: unknown = JSON.parse(raw);
    if (!Array.isArray(body)) return [];
    return body.filter((row): row is StoredOfflineScan => {
      if (!row || typeof row !== 'object') return false;
      const r = row as Record<string, unknown>;
      return (
        typeof r.clientEventId === 'string' &&
        typeof r.ticketId === 'string' &&
        typeof r.eventId === 'string' &&
        typeof r.tenantId === 'string' &&
        typeof r.staffSessionId === 'string' &&
        typeof r.clientOccurredAt === 'string' &&
        typeof r.clientSeq === 'number' &&
        typeof r.localStatus === 'string'
      );
    });
  } catch {
    return [];
  }
}

function parseSeqMap(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const secureOfflineQueueStore: OfflineQueueStore = {
  async readQueue() {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY, options);
    return parseQueue(raw);
  },
  async writeQueue(items) {
    await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(items), options);
  },
  async readDeviceId() {
    return SecureStore.getItemAsync(DEVICE_KEY, options);
  },
  async writeDeviceId(id) {
    await SecureStore.setItemAsync(DEVICE_KEY, id, options);
  },
  async readSeqMap() {
    const raw = await SecureStore.getItemAsync(SEQ_KEY, options);
    return parseSeqMap(raw);
  },
  async writeSeqMap(map) {
    await SecureStore.setItemAsync(SEQ_KEY, JSON.stringify(map), options);
  },
};
