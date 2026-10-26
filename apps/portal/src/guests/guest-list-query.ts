import { bffEventAction } from '../prep/bff-urls';

export type GuestListKind = 'invitations' | 'redemptions' | 'tickets';

export const GUEST_LIST_PAGE_SIZE = 20;

/** Exact ticket ID (UUID) only until backend exposes paged email/code search. */
export const TICKET_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TICKET_SEARCH_VALIDATION_MESSAGE =
  'Nhập mã vé (UUID) chính xác để tìm. Tìm theo email hoặc mã đổi chưa hỗ trợ trong phiên bản này.';

export function validateTicketIdSearch(
  value: string,
): { ok: true; ticketId: string } | { ok: false; message: string } {
  const ticketId = value.trim();
  if (!ticketId) {
    return { ok: false, message: TICKET_SEARCH_VALIDATION_MESSAGE };
  }
  if (!TICKET_ID_UUID.test(ticketId)) {
    return { ok: false, message: TICKET_SEARCH_VALIDATION_MESSAGE };
  }
  return { ok: true, ticketId };
}

export function defaultGuestListKind(
  permissions: readonly string[],
): GuestListKind {
  if (permissions.includes('cs.lookup')) return 'tickets';
  if (permissions.includes('redemption.approve')) return 'redemptions';
  if (permissions.includes('inventory.import')) return 'invitations';
  return 'tickets';
}

export function guestListKindFromHash(hash: string): GuestListKind | null {
  const value = hash.replace(/^#/, '');
  if (value === 'tickets') return 'tickets';
  if (value === 'requests' || value === 'redemptions') return 'redemptions';
  if (value === 'invitations') return 'invitations';
  return null;
}

export function guestListKindToHash(kind: GuestListKind): string {
  return kind === 'redemptions' ? 'requests' : kind;
}

/** Server cursor pagination; ticket UUID search is at most one row — never send cursor with q. */
export function buildGuestListQueryPath(
  tenantId: string,
  eventId: string,
  kind: GuestListKind,
  cursor: string | null,
  state: string,
  search: string,
): string {
  const params = new URLSearchParams({ limit: String(GUEST_LIST_PAGE_SIZE) });
  const ticketSearch = kind === 'tickets' && search.trim() ? search.trim() : '';
  const effectiveCursor = ticketSearch ? null : cursor;
  if (effectiveCursor) params.set('cursor', effectiveCursor);
  if (kind === 'invitations' && state) params.set('state', state);
  if (kind === 'redemptions') {
    params.set('status', 'PENDING_REVIEW');
    if (search.trim()) params.set('q', search.trim());
  }
  if (ticketSearch) params.set('q', ticketSearch);
  return `${bffEventAction(tenantId, eventId, kind)}?${params}`;
}

export function ticketSearchBlocksPagination(search: string): boolean {
  return Boolean(search.trim());
}
