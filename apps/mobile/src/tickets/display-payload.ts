import type { TicketSummary } from '@ticket/contracts';

/** Serialize the backend-signed Gate envelope without projecting ticket IDs. */
export function buildDisplayQrPayload(ticket: TicketSummary): string {
  return JSON.stringify(ticket.gateCredential);
}
