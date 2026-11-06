import type { StaffGateScope } from './staff-gate-events.ts';
import { resolveGateScanFallback } from './staff-gate-scope-resolve.ts';
import type { GateScanStatusKind } from './gate-scan-status-ui.ts';

export type ManualEntryCheckResult =
  | { ok: true; code: string; previewLine: string }
  | { ok: false; message: string };

export type ManualResultAction = 'next' | 'other' | 'reconcile' | null;

export function canSubmitManualConfirmation(
  code: string,
  scanDisabled: boolean,
  connectivity: 'online' | 'offline' | 'unknown',
): boolean {
  return Boolean(code.trim()) && !scanDisabled && connectivity !== 'offline';
}

/** The manual screen never grants admission for an unresolved operation. */
export function manualResultAction(
  kind: GateScanStatusKind,
  hasReconcileOperation: boolean,
): ManualResultAction {
  if (kind === 'admitted') return 'next';
  if (kind === 'denied' || kind === 'already-checked-in') return 'other';
  if (kind === 'unknown' && hasReconcileOperation) return 'reconcile';
  return null;
}

export function buildManualEntryPreviewLine(
  scopeName: string | null | undefined,
): string {
  return `${scopeName?.trim() || 'Sự kiện đang chọn'} · Mã sẽ được kiểm tra trực tuyến`;
}

export function checkManualEntryCode(
  raw: string,
  gateScope: StaffGateScope | null,
): ManualEntryCheckResult {
  const code = raw.trim();
  if (!code) {
    return { ok: false, message: 'Nhập mã trên vé trước khi kiểm tra.' };
  }
  const scope = resolveGateScanFallback(gateScope);
  if (!scope.tenantId || !scope.eventId) {
    return { ok: false, message: 'Chọn sự kiện và cổng trước khi kiểm tra mã.' };
  }
  if (!/^[a-z0-9-]{10,12}$/i.test(code) || /^[0-9a-f-]{36}$/i.test(code)) {
    return {
      ok: false,
      message: 'Mã nhập tay không hợp lệ. Kiểm tra lại mã trên vé.',
    };
  }
  return {
    ok: true,
    code,
    previewLine: buildManualEntryPreviewLine(gateScope?.name),
  };
}
