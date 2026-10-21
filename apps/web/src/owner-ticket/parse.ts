import type { OwnerTicketDetail, WalletTicketRow } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Fail-closed parse of Nest owner ticket detail / TicketSummary.
 * Rejects bodies that omit required fields.
 */
function readOptionalEventName(body: Record<string, unknown>): string | undefined {
  const name =
    typeof body.eventName === 'string' ? body.eventName.trim() : '';
  return name.length > 0 ? name : undefined;
}

export function parseOwnerTicketDetail(raw: unknown): OwnerTicketDetail | null {
  const body = asRecord(raw);
  if (!body) return null;

  const ticketId =
    typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  const tenantId =
    typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const ticketTypeId =
    typeof body.ticketTypeId === 'string' ? body.ticketTypeId.trim() : '';
  const sourceId =
    typeof body.sourceId === 'string' ? body.sourceId.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const createdAt =
    typeof body.createdAt === 'string' ? body.createdAt.trim() : '';
  const credentialVersion = body.credentialVersion;

  if (
    !ticketId ||
    !tenantId ||
    !eventId ||
    !ticketTypeId ||
    !sourceId ||
    !state ||
    !createdAt ||
    typeof credentialVersion !== 'number' ||
    !Number.isFinite(credentialVersion)
  ) {
    return null;
  }

  return {
    ticketId,
    tenantId,
    eventId,
    ticketTypeId,
    sourceId,
    state,
    credentialVersion,
    createdAt,
  };
}

/** Fail-closed parse of Nest GET /v1/me/tickets (aggregate or scoped). */
export function parseMeTicketsResponse(raw: unknown): WalletTicketRow[] | null {
  const body = asRecord(raw);
  if (!body || !Array.isArray(body.tickets)) return null;
  const tickets: WalletTicketRow[] = [];
  for (const item of body.tickets) {
    const row = asRecord(item);
    if (!row) return null;
    const base = parseOwnerTicketDetail(row);
    if (!base) return null;
    const eventName = readOptionalEventName(row);
    tickets.push(eventName ? { ...base, eventName } : base);
  }
  return tickets;
}

/** `/t/{slug}/tickets/{uuid}` — matches buildOwnerTicketLink. */
const OWNER_TICKET_PATH_RE =
  /^\/t\/([a-z0-9][a-z0-9-]{0,62})\/tickets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function isOwnerTicketPath(pathOnly: string): boolean {
  return OWNER_TICKET_PATH_RE.test(pathOnly);
}

export function matchOwnerTicketPath(
  pathOnly: string,
): { tenantSlug: string; ticketId: string } | null {
  const m = OWNER_TICKET_PATH_RE.exec(pathOnly);
  if (!m) return null;
  return {
    tenantSlug: m[1]!.toLowerCase(),
    ticketId: m[2]!.toLowerCase(),
  };
}
