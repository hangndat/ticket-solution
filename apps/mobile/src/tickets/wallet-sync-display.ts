/**
 * PRD M08 — show honest last-sync time from persisted cache metadata (never invented).
 */

const VI_DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

export function parseWalletSyncedAt(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/** Vietnamese locale formatting for wallet offline banner. */
export function formatWalletLastSyncedVi(iso: string | null | undefined): string | null {
  const date = parseWalletSyncedAt(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat('vi-VN', VI_DATE).format(date);
}

export function walletOfflineNoticeBody(
  baseBody: string,
  syncedAtIso: string | null | undefined,
): string {
  const formatted = formatWalletLastSyncedVi(syncedAtIso);
  if (!formatted) return baseBody;
  return `${baseBody}\n\nLần đồng bộ gần nhất: ${formatted}. Trạng thái vé có thể đã thay đổi trên máy chủ.`;
}
