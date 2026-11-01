import type { OwnerTicketDetail } from './types';

/** Return the versioned QR envelope; ticket IDs are never QR credentials. */
export function gateCredentialQrValue(ticket: OwnerTicketDetail): string | null {
  const credential = ticket.gateCredential;
  if (
    ticket.state !== 'ACTIVE' ||
    !credential ||
    credential.v !== 1 ||
    credential.kind !== 'ticket.gate_credential' ||
    !credential.jws
  ) {
    return null;
  }

  return JSON.stringify({
    v: 1,
    kind: 'ticket.gate_credential',
    jws: credential.jws,
  });
}
