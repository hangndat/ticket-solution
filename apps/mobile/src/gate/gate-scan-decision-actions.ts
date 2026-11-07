import { canReconcile, type GateOp } from './gate-scan.ts';
import type {
  ConnectivityState,
  OfflineQueueSnapshot,
} from './offline-queue.ts';

/** Actions for the current camera decision, never inferred from a stale count. */
export function scanDecisionActions(input: {
  op: GateOp | null;
  queue: OfflineQueueSnapshot;
  connectivity: ConnectivityState;
  busy: boolean;
}): { reconcile: boolean; sync: boolean; continueScan: boolean } {
  const { op, queue, connectivity, busy } = input;
  if (!op || busy)
    return { reconcile: false, sync: false, continueScan: false };
  const queuedItem = op.clientEventId
    ? queue.items.find(
        (item) =>
          item.clientEventId === op.clientEventId &&
          item.tenantId === op.tenantId &&
          item.eventId === op.eventId &&
          item.staffSessionId === op.staffSessionId &&
          item.ticketId === op.ticketId,
      )
    : undefined;
  return {
    reconcile: canReconcile(op),
    sync:
      op.phase === 'queued' &&
      queuedItem?.localStatus === 'pending' &&
      connectivity === 'online' &&
      !queue.syncing,
    continueScan: true,
  };
}
