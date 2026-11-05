import type { TicketSummary } from '@ticket/contracts';

/** Serialize the backend-signed Gate envelope without projecting ticket IDs. */
export function buildDisplayQrPayload(ticket: TicketSummary): string {
  const credential = ticket.gateCredential;
  // Legacy API responses and persisted caches can predate the signed contract.
  // Never turn their ticket IDs (or a malformed envelope) into a Gate QR.
  if (
    !credential ||
    credential.v !== 1 ||
    credential.kind !== 'ticket.gate_credential' ||
    typeof credential.jws !== 'string' ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential.jws)
  ) {
    return '';
  }
  return JSON.stringify(credential);
}
