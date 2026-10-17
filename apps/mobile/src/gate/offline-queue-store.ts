import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import type {
  OfflineQueueStore,
  StoredOfflineScan,
} from './offline-queue-types.ts';

export type { OfflineQueueStore, StoredOfflineScan } from './offline-queue-types.ts';

/**
 * FileSystem-backed Gate offline queue (documentDirectory JSON).
 * Avoids expo-secure-store / RN Settings Keychain·UserDefaults wedges on Simulator.
 * OIDC credentials remain in SecureStore (identity slice).
 */

const DEVICE_KEY = 'device-id';
const memory = new Map<string, string>();

function rootDir(): string | null {
  return documentDirectory ? `${documentDirectory}ticket-gate-offline/` : null;
}

function fileUri(name: string): string | null {
  const root = rootDir();
  return root ? `${root}${name}.json` : null;
}

function queueFile(userId: string): string {
  return `queue-${userId}`;
}

function seqFile(userId: string): string {
  return `seq-${userId}`;
}

async function ensureRoot(): Promise<string | null> {
  const root = rootDir();
  if (!root) return null;
  try {
    await makeDirectoryAsync(root, { intermediates: true });
  } catch {
    /* exists */
  }
  return root;
}

async function readString(name: string): Promise<string | null> {
  const cached = memory.get(name);
  if (cached !== undefined) return cached;
  const uri = fileUri(name);
  if (!uri) return null;
  try {
    await ensureRoot();
    const raw = await readAsStringAsync(uri);
    if (typeof raw === 'string') {
      memory.set(name, raw);
      return raw;
    }
  } catch {
    /* missing file */
  }
  return null;
}

async function writeString(name: string, value: string): Promise<void> {
  memory.set(name, value);
  const uri = fileUri(name);
  if (!uri) return;
  try {
    await ensureRoot();
    await writeAsStringAsync(uri, value, { encoding: 'utf8' });
  } catch {
    /* memory mirror still holds value for this process */
  }
}

async function deleteString(name: string): Promise<void> {
  memory.delete(name);
  const uri = fileUri(name);
  if (!uri) return;
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
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
    return parseQueue(await readString(queueFile(userId)));
  },
  async writeQueue(userId, items) {
    if (!userId) return;
    await writeString(queueFile(userId), JSON.stringify(items));
  },
  async clearQueue(userId) {
    if (!userId) return;
    await deleteString(queueFile(userId));
  },
  async readDeviceId() {
    return readString(DEVICE_KEY);
  },
  async writeDeviceId(id) {
    await writeString(DEVICE_KEY, id);
  },
  async readSeqMap(userId) {
    if (!userId) return {};
    return parseSeqMap(await readString(seqFile(userId)));
  },
  async writeSeqMap(userId, map) {
    if (!userId) return;
    await writeString(seqFile(userId), JSON.stringify(map));
  },
  async clearSeqMap(userId) {
    if (!userId) return;
    await deleteString(seqFile(userId));
  },
};
