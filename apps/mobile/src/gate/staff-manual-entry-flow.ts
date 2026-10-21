import { parseScan, type ParsedScan } from './gate-scan.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { resolveGateScanFallback } from './staff-gate-scope-resolve.ts';

export type ManualEntryCheckResult =
  | { ok: true; parsed: ParsedScan; previewLine: string }
  | { ok: false; message: string };

export function buildManualEntryPreviewLine(
  scopeName: string | null | undefined,
  parsed: ParsedScan,
): string {
  const eventLabel = scopeName?.trim() || 'Sự kiện đang chọn';
  return `${eventLabel} · Mã vé ${parsed.ticketId}`;
}

export function checkManualEntryCode(
  raw: string,
  gateScope: StaffGateScope | null,
): ManualEntryCheckResult {
  const code = raw.trim();
  if (!code) {
    return { ok: false, message: 'Nhập mã trên vé trước khi kiểm tra.' };
  }
  const fallback = resolveGateScanFallback(gateScope);
  const parsed = parseScan(code, fallback);
  if (!parsed) {
    return {
      ok: false,
      message: 'Mã không đọc được. Kiểm tra lại mã trên vé.',
    };
  }
  return {
    ok: true,
    parsed,
    previewLine: buildManualEntryPreviewLine(gateScope?.name, parsed),
  };
}
