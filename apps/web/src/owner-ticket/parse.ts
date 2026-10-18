import type { OwnerTicketDetail } from './types';

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
