import type { OwnerTicketDetail } from './types';

/** Return only the backend-signed JWS; ticket IDs are never QR credentials. */
export function gateCredentialQrValue(ticket: OwnerTicketDetail): string | null {
  return ticket.state === 'ACTIVE' ? ticket.gateCredential?.jws ?? null : null;
}
