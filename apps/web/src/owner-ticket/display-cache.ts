/**
 * Session-scoped ticket display cache for offline re-read (QR payload only).
 * Never stores refresh tokens or PII beyond ticket ids already on the URL.
 */

const STORAGE_PREFIX = 'vemoki:owner-ticket-display:v1:';

export type OwnerTicketDisplayCache = {
  tenantId: string;
  ticketId: string;
  qrPayload: string;
  state: string;
  cachedAt: string;
};

function storageKey(tenantId: string, ticketId: string): string {
  return `${STORAGE_PREFIX}${tenantId}:${ticketId}`;
}

export function writeOwnerTicketDisplayCache(
  entry: OwnerTicketDisplayCache,
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      storageKey(entry.tenantId, entry.ticketId),
      JSON.stringify(entry),
    );
  } catch {
    // Quota or private mode — ignore.
  }
}

export function readOwnerTicketDisplayCache(
  tenantId: string,
  ticketId: string,
): OwnerTicketDisplayCache | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(tenantId, ticketId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerTicketDisplayCache;
    if (
      parsed.tenantId !== tenantId ||
      parsed.ticketId !== ticketId ||
      typeof parsed.qrPayload !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
