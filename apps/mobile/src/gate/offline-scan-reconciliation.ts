import type { GateOp } from './gate-scan.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canApplyOfflineReplay(input: {
  replayUserId: string;
  verifiedUserId: string | null;
  queueOwnerUserId: string | null;
  startedGeneration: number;
  currentGeneration: number;
  startedScope: StaffGateScope | null;
  currentScope: StaffGateScope | null;
  startedSessionId: string | null;
  currentSessionId: string | null;
}): boolean {
  const { startedScope, currentScope } = input;
  return input.verifiedUserId === input.replayUserId &&
    input.queueOwnerUserId === input.replayUserId &&
    input.startedGeneration === input.currentGeneration &&
    Boolean(startedScope && currentScope &&
      startedScope.tenantId === currentScope.tenantId &&
      startedScope.eventId === currentScope.eventId &&
      input.startedSessionId &&
      input.startedSessionId === input.currentSessionId);
}

/** Reconcile only the exact queued operation in its original staff session. */
export function reconcileOfflineScanOps(
  ops: readonly GateOp[],
  rows: readonly QueuedOfflineScan[],
): GateOp[] {
  const byId = new Map(rows.map((row) => [row.clientEventId, row]));
  return ops.map((op) => {
    if (op.phase !== 'queued' || !op.clientEventId) return op;
    const row = byId.get(op.clientEventId);
    if (
      !row || row.tenantId !== op.tenantId || row.eventId !== op.eventId ||
      row.ticketId !== op.ticketId || row.staffSessionId !== op.staffSessionId
    ) {
      return {
        ...op,
        phase: 'unknown',
        message: 'Không còn biên nhận hàng đợi khớp lượt quét này trên máy. Kết quả chưa rõ — kiểm tra với máy chủ trước khi cho vào.',
      };
    }

    if (row.localStatus === 'applied' || row.localStatus === 'duplicate') {
      const checkinId = row.checkinId?.trim();
      if (!checkinId || !UUID.test(checkinId)) {
        return { ...op, phase: 'unknown', message: 'Máy chủ chưa trả mã check-in hợp lệ. Chưa cho vào; cần đối soát.' };
      }
      const prior = row.localStatus === 'duplicate';
      return {
        ...op,
        phase: 'admitted',
        checkinId,
        admissionKind: prior ? 'already' : 'fresh',
        message: prior
          ? 'Sự kiện offline này đã được áp dụng trước đó — dùng kết quả check-in đã có, không tạo lượt mới.'
          : 'Đã đồng bộ. Máy chủ ghi nhận check-in — có thể cho khách qua.',
      };
    }
    if (row.localStatus === 'rejected' || row.localStatus === 'conflict') {
      return { ...op, phase: 'denied', message: row.lastMessage || 'Đồng bộ bị từ chối. Không cho vào.' };
    }
    return op;
  });
}

/** Commit only changed replay outcomes onto the current view after async GETs. */
export function rebaseOfflineReplayOps(
  started: readonly GateOp[],
  reconciled: readonly GateOp[],
  latest: readonly GateOp[],
): GateOp[] {
  const changes = new Map<string, GateOp>();
  reconciled.forEach((op, index) => {
    if (op !== started[index]) changes.set(op.clientEventId ?? op.id, op);
  });
  return latest.map((op) => {
    const changed = changes.get(op.clientEventId ?? op.id);
    if (!changed || op.phase === 'recorded') return op;
    return changed;
  });
}
