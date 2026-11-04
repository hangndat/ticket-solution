import {
  OFFLINE_SYNC_MAX_BATCH,
  compareOfflineReplayOrder,
} from './offline-sync-contract.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';

/** Keep first-seen event/session order while sorting each session for replay. */
export function planOfflineReplay(
  pending: readonly QueuedOfflineScan[],
): Map<string, QueuedOfflineScan[][]> {
  const byEvent = new Map<string, Map<string, QueuedOfflineScan[]>>();
  for (const item of pending) {
    let bySession = byEvent.get(item.eventId);
    if (!bySession) {
      bySession = new Map();
      byEvent.set(item.eventId, bySession);
    }
    const sessionKey = `${item.tenantId}::${item.staffSessionId}`;
    const group = bySession.get(sessionKey) ?? [];
    group.push(item);
    bySession.set(sessionKey, group);
  }

  const planned = new Map<string, QueuedOfflineScan[][]>();
  for (const [eventId, bySession] of byEvent) {
    const chunks: QueuedOfflineScan[][] = [];
    for (const group of bySession.values()) {
      const sorted = group.slice().sort(compareOfflineReplayOrder);
      for (let i = 0; i < sorted.length; i += OFFLINE_SYNC_MAX_BATCH) {
        chunks.push(sorted.slice(i, i + OFFLINE_SYNC_MAX_BATCH));
      }
    }
    planned.set(eventId, chunks);
  }
  return planned;
}
