import { canReconcile, type GateOp } from './gate-scan.ts';
import { presentQueueStatus, shortId } from './gate-outcome-copy.ts';
import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

export type DeviceScanHistoryRow = {
  id: string;
  at: string;
  ticketLabel: string;
  /** Mã lượt (clientEventId) for staff cross-check. */
  operationLabel: string;
  /** Full UUID for a11y / copy when shortened in UI. */
  operationIdFull?: string;
  /** Mã check-in từ receipt khi có. */
  receiptLabel: string;
  receiptIdFull?: string;
  statusLabel: string;
  hint: string;
  tone: 'admit' | 'deny' | 'unknown' | 'default';
  source: 'scan' | 'offline-queue';
};

/** Default page size for “Tải thêm” — not a hard cap on stored history. */
export const DEVICE_HISTORY_PAGE_SIZE = 12;

export type DeviceHistoryPageView = {
  rows: DeviceScanHistoryRow[];
  loadedCount: number;
  totalAvailable: number;
  hasMore: boolean;
};

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
    const operationLabel = op.clientEventId
      ? shortId(op.clientEventId, 12)
      : shortId(op.id, 12);
    const receiptLabel = op.checkinId ? shortId(op.checkinId, 12) : '—';
    const crossCheck =
      op.clientEventId || op.checkinId
        ? `Mã lượt ${operationLabel}${op.checkinId ? ` · Biên nhận ${receiptLabel}` : ''}`
        : '';
    rows.push({
      id: op.id,
      at: op.recordedAt ?? '',
      ticketLabel: op.ticketId ? shortId(op.ticketId, 10) : '—',
      operationLabel,
      operationIdFull: op.clientEventId ?? undefined,
      receiptLabel,
      receiptIdFull: op.checkinId ?? undefined,
      statusLabel: status.label,
      hint: crossCheck ? `${status.hint} ${crossCheck}` : status.hint,
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
      operationLabel: shortId(item.clientEventId, 12),
      operationIdFull: item.clientEventId,
      receiptLabel: item.checkinId ? shortId(item.checkinId, 12) : '—',
      receiptIdFull: item.checkinId ?? undefined,
      statusLabel: q.label,
      hint: `Mã lượt ${shortId(item.clientEventId, 12)}${item.checkinId ? ` · Biên nhận ${shortId(item.checkinId, 12)}` : ''}. ${item.lastMessage ?? q.detail}`,
      tone: q.tone,
      source: 'offline-queue',
    });
  }

  return rows
    .filter((row) => row.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function filterLoadedDeviceHistoryRows(
  loadedRows: readonly DeviceScanHistoryRow[],
  filterQuery: string,
): DeviceScanHistoryRow[] {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return [...loadedRows];
  return loadedRows.filter(
    (row) =>
      row.ticketLabel.toLowerCase().includes(q) ||
      row.statusLabel.toLowerCase().includes(q),
  );
}

export function computeDeviceHistoryPageView(
  allRows: readonly DeviceScanHistoryRow[],
  visibleCount: number,
  filterQuery: string,
): DeviceHistoryPageView {
  const limit = Math.max(0, visibleCount);
  const loaded = allRows.slice(0, limit);
  const rows = filterLoadedDeviceHistoryRows(loaded, filterQuery);
  return {
    rows,
    loadedCount: loaded.length,
    totalAvailable: allRows.length,
    hasMore: limit < allRows.length,
  };
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

export type DeviceHistoryDaySection = {
  dayKey: string;
  headerLabel: string;
  rows: DeviceScanHistoryRow[];
};

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHistoryDayHeader(date: Date, now: Date): string {
  const dayMonth = new Intl.DateTimeFormat('vi', {
    day: 'numeric',
    month: 'long',
  }).format(date);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Hôm nay · ${dayMonth}`;
  const weekday = new Intl.DateTimeFormat('vi', { weekday: 'long' }).format(date);
  return `${weekday} · ${dayMonth}`;
}

/** Group device history rows by local calendar day (VI section headers). */
export function groupDeviceHistoryByDay(
  rows: readonly DeviceScanHistoryRow[],
  now: Date = new Date(),
): DeviceHistoryDaySection[] {
  const sections: DeviceHistoryDaySection[] = [];
  let currentKey: string | null = null;
  let current: DeviceHistoryDaySection | null = null;

  for (const row of rows) {
    const date = new Date(row.at);
    const key = Number.isNaN(date.getTime()) ? 'unknown' : localDayKey(date);
    if (key !== currentKey) {
      currentKey = key;
      const headerLabel = Number.isNaN(date.getTime())
        ? 'Không rõ ngày'
        : formatHistoryDayHeader(date, now);
      current = { dayKey: key, headerLabel, rows: [] };
      sections.push(current);
    }
    current!.rows.push(row);
  }
  return sections;
}
