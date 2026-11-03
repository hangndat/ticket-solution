import type { StaffGateScope } from './staff-gate-events.ts';
import { resolveGateScanFallback } from './staff-gate-scope-resolve.ts';

export type ManualEntryCheckResult =
  | { ok: true; code: string; previewLine: string }
  | { ok: false; message: string };

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
