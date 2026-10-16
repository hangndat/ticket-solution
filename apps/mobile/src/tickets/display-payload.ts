import type { TicketSummary } from '@ticket/contracts';

/**
 * Compact offline-display payload for QR. Contracts (GET /v1/me/tickets) do not
 * yet return a signed Gate credential/JWS — this encodes TicketSummary fields
 * only. Gate must not treat this as check-in proof.
 */
export function buildDisplayQrPayload(ticket: TicketSummary): string {
  return JSON.stringify({
    v: 1,
    kind: 'ticket.display',
    ticketId: ticket.ticketId,
    tenantId: ticket.tenantId,
    eventId: ticket.eventId,
    credentialVersion: ticket.credentialVersion,
    state: ticket.state,
  });
}
