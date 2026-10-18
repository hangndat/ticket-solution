import type { OwnerTicketDetail } from './types';

/**
 * Compact display QR payload (mirrors apps/mobile).
 * Not a Gate check-in credential — Gate must not treat this as proof.
 */
export function buildDisplayQrPayload(ticket: OwnerTicketDetail): string {
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
