import { canReconcile, type GateOp } from './gate-scan.ts';
import { presentQueueStatus, shortId } from './gate-outcome-copy.ts';
import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

export type DeviceScanHistoryRow = {
  id: string;
  at: string;
  ticketLabel: string;
  statusLabel: string;
  hint: string;
  tone: 'admit' | 'deny' | 'unknown' | 'default';
  source: 'scan' | 'offline-queue';
};

const MAX_ROWS = 12;

export function buildDeviceScanHistory(
  scope: StaffGateScope | null,
  ops: readonly GateOp[],
  queueItems: readonly QueuedOfflineScan[],
): DeviceScanHistoryRow[] {
  if (!scope) return [];

  const scopedOps = ops.filter(
    (op) =>
      op.tenantId === scope.tenantId && op.eventId === scope.eventId,
  );
  const scopedQueue = queueItems.filter(
    (item) =>
      item.tenantId === scope.tenantId && item.eventId === scope.eventId,
  );

  const opIds = new Set(
    scopedOps.map((op) => op.clientEventId).filter(Boolean) as string[],
  );

  const rows: DeviceScanHistoryRow[] = [];

  for (const op of scopedOps) {
    if (!op.ticketId && op.phase === 'denied' && !op.recordedAt) continue;
    const status = presentGateScanStatus({
      busy: false,
      op,
      canReconcile: canReconcile(op),
    });
    rows.push({
      id: op.id,
      at: op.recordedAt ?? '',
      ticketLabel: op.ticketId ? shortId(op.ticketId, 10) : '—',
      statusLabel: status.label,
      hint: status.hint,
      tone: status.tone,
      source: 'scan',
    });
  }

  for (const item of scopedQueue) {
    if (opIds.has(item.clientEventId)) continue;
    const q = presentQueueStatus(item.localStatus);
    rows.push({
      id: item.clientEventId,
      at: item.clientOccurredAt,
      ticketLabel: shortId(item.ticketId, 10),
      statusLabel: q.label,
      hint: item.lastMessage ?? q.detail,
      tone: q.tone,
      source: 'offline-queue',
    });
  }

  return rows
    .filter((row) => row.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_ROWS);
}

export function formatDeviceHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}
