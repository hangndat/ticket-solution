import * as SecureStore from 'expo-secure-store';
import { runGateForOwner, serialGateStorage } from './staff-gate-workspace-store.ts';
import type {
  OfflineQueueStore,
  StoredOfflineScan,
} from './offline-queue-types.ts';

export type { OfflineQueueStore, StoredOfflineScan } from './offline-queue-types.ts';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.gate-offline-queue',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Device-global (physical device identity for ADR-18 deviceId). */
const DEVICE_KEY = 'ticket.gate.device-id.v1';

function queueKey(userId: string): string {
  return `ticket.gate.offline-queue.v1.${userId}`;
}

function seqKey(userId: string): string {
  return `ticket.gate.offline-seq.v1.${userId}`;
}

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
  async readQueue(userId) {
    if (!userId) return [];
    return runGateForOwner(userId, async () => parseQueue(await SecureStore.getItemAsync(queueKey(userId), options)));
  },
  async writeQueue(userId, items) {
    if (!userId) return;
    await runGateForOwner(userId, () => SecureStore.setItemAsync(
      queueKey(userId),
      JSON.stringify(items),
      options,
    ));
  },
  async clearQueue(userId) {
    if (!userId) return;
    await serialGateStorage(() => SecureStore.deleteItemAsync(queueKey(userId), options));
  },
  async readDeviceId() {
    return SecureStore.getItemAsync(DEVICE_KEY, options);
  },
  async writeDeviceId(id) {
    await SecureStore.setItemAsync(DEVICE_KEY, id, options);
  },
  async readSeqMap(userId) {
    if (!userId) return {};
    return runGateForOwner(userId, async () => parseSeqMap(await SecureStore.getItemAsync(seqKey(userId), options)));
  },
  async writeSeqMap(userId, map) {
    if (!userId) return;
    await runGateForOwner(userId, () => SecureStore.setItemAsync(
      seqKey(userId),
      JSON.stringify(map),
      options,
    ));
  },
  async clearSeqMap(userId) {
    if (!userId) return;
    await serialGateStorage(() => SecureStore.deleteItemAsync(seqKey(userId), options));
  },
};
