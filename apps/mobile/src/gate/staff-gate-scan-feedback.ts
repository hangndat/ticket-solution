import { canReconcile, type GateOp } from './gate-scan.ts';

/** Toast visible duration before fade-out (all scan outcomes). */
export const SCAN_TOAST_VISIBLE_MS = 2600;
export const SCAN_TOAST_FADE_MS = 400;

/** @deprecated use SCAN_TOAST_VISIBLE_MS */
export const TERMINAL_SCAN_FLASH_MS = SCAN_TOAST_VISIBLE_MS;

export type ScanFeedbackLifecycle =
  | 'idle'
  | 'processing'
  | 'sticky'
  | 'terminal-flash';

/** Brief camera overlay — only terminal admit/recorded; sticky outcomes use the panel below. */
export function shouldShowCameraToast(op: GateOp | null, busy: boolean): boolean {
  if (busy) return true;
  if (!op) return false;
  return classifyScanFeedbackLifecycle(op, false) === 'terminal-flash';
}

export function classifyScanFeedbackLifecycle(
  op: GateOp | null,
  busy: boolean,
): ScanFeedbackLifecycle {
  if (busy) return 'processing';
  if (!op) return 'idle';
  if (op.phase === 'holding' || op.phase === 'confirming') return 'sticky';
  if (op.phase === 'queued') return 'sticky';
  if (op.phase === 'unknown') return 'sticky';
  if (op.phase === 'denied') return 'sticky';
  if (op.phase === 'recorded') return 'terminal-flash';
  if (op.phase === 'admitted') return 'terminal-flash';
  return 'sticky';
}

export function needsStickyPendingOp(op: GateOp | null): boolean {
  if (!op) return false;
  return classifyScanFeedbackLifecycle(op, false) === 'sticky';
}

/** Manual / sticky UI: pending op survives toast timer clear. */
export function selectScanFeedbackOp(
  pendingOp: GateOp | null,
  toastOp: GateOp | null,
): GateOp | null {
  return pendingOp ?? toastOp;
}

/** Camera dedupe + feedback chrome — toast visible counts as active feedback. */
export function cameraFeedbackLifecycle(
  busy: boolean,
  toastVisible: boolean,
  pendingOp: GateOp | null,
): ScanFeedbackLifecycle {
  if (busy) return 'processing';
  if (toastVisible) return 'terminal-flash';
  if (pendingOp) return 'sticky';
  return 'idle';
}

export function shouldDismissToastAttempt(
  scheduledAttemptId: string,
  currentAttemptId: string | null,
): boolean {
  return currentAttemptId !== null && scheduledAttemptId === currentAttemptId;
}

/** @deprecated */
export function shouldClearProminentOnTerminalTimer(
  scheduledAttemptId: string,
  currentAttemptId: string | null,
): boolean {
  return shouldDismissToastAttempt(scheduledAttemptId, currentAttemptId);
}

export function prominentCanReconcile(op: GateOp | null): boolean {
  return op ? canReconcile(op) : false;
}

export function shouldSuppressCameraRescan(
  normalizedPayload: string,
  lastCameraPayload: string | null,
  lifecycle: ScanFeedbackLifecycle,
): boolean {
  if (!normalizedPayload || !lastCameraPayload) return false;
  if (normalizedPayload !== lastCameraPayload) return false;
  return lifecycle !== 'idle';
}

export function machineOperationalLabel(input: {
  busy: boolean;
  ready: boolean;
  gateEventsLoading: boolean;
  hasGateScope: boolean;
  pendingOp: GateOp | null;
  queuePendingCount: number;
}): string {
  if (input.busy) return 'Đang xử lý quét';
  if (!input.ready || input.gateEventsLoading) return 'Đang tải cổng…';
  if (!input.hasGateScope) return 'Chọn sự kiện cổng';
  if (
    input.pendingOp?.phase === 'confirming' ||
    input.pendingOp?.phase === 'holding'
  ) {
    return 'Chờ xác nhận máy chủ';
  }
  if (input.pendingOp && canReconcile(input.pendingOp)) {
    return 'Cần đối soát kết quả';
  }
  if (input.pendingOp?.phase === 'queued') {
    return 'Có lượt chờ đồng bộ offline';
  }
  if (input.queuePendingCount > 0) {
    return `Hàng đợi offline (${input.queuePendingCount})`;
  }
  return 'Sẵn sàng quét';
}
