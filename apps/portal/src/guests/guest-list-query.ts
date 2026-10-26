import { bffEventAction } from '../prep/bff-urls';

export type GuestListKind = 'invitations' | 'redemptions' | 'tickets';

export const GUEST_LIST_PAGE_SIZE = 20;

/** Exact ticket ID (UUID) only until backend exposes paged email/code search. */
export const TICKET_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TICKET_SEARCH_VALIDATION_MESSAGE =
  'Nhập mã vé (UUID) chính xác để tìm. Tìm theo email hoặc mã đổi chưa hỗ trợ trong phiên bản này.';

export const INVITATION_SEARCH_VALIDATION_MESSAGE =
  'Nhập mã lời mời (UUID) chính xác để tìm. Tìm theo email chưa hỗ trợ trong phiên bản này.';

function validateExactUuidSearch(
  value: string,
  message: string,
): { ok: true; id: string } | { ok: false; message: string } {
  const id = value.trim();
  if (!id) {
    return { ok: false, message };
  }
  if (!TICKET_ID_UUID.test(id)) {
    return { ok: false, message };
  }
  return { ok: true, id };
}

export function validateTicketIdSearch(
  value: string,
): { ok: true; ticketId: string } | { ok: false; message: string } {
  const result = validateExactUuidSearch(value, TICKET_SEARCH_VALIDATION_MESSAGE);
  if (!result.ok) return result;
  return { ok: true, ticketId: result.id };
}

export function validateInvitationIdSearch(
  value: string,
): { ok: true; invitationId: string } | { ok: false; message: string } {
  const result = validateExactUuidSearch(
    value,
    INVITATION_SEARCH_VALIDATION_MESSAGE,
  );
  if (!result.ok) return result;
  return { ok: true, invitationId: result.id };
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

/** Server cursor pagination; exact UUID lookup is at most one row — never send cursor with q. */
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
  const invitationSearch =
    kind === 'invitations' && search.trim() ? search.trim() : '';
  const uuidLookup = ticketSearch || invitationSearch;
  const effectiveCursor = uuidLookup ? null : cursor;
  if (effectiveCursor) params.set('cursor', effectiveCursor);
  if (kind === 'invitations' && state) params.set('state', state);
  if (kind === 'redemptions') {
    params.set('status', 'PENDING_REVIEW');
    if (search.trim()) params.set('q', search.trim());
  }
  if (ticketSearch) params.set('q', ticketSearch);
  if (invitationSearch) params.set('q', invitationSearch);
  return `${bffEventAction(tenantId, eventId, kind)}?${params}`;
}

export function ticketSearchBlocksPagination(search: string): boolean {
  return Boolean(search.trim());
}

export function invitationSearchBlocksPagination(search: string): boolean {
  return Boolean(search.trim());
}
