/** Online Gate credential transport. The offline-sync contract remains ADR-18. */
export const GATE_CREDENTIAL_ENDPOINTS = {
  manualLookup: '/v1/gate/events/{eventId}/manual-lookup',
  reserve: '/v1/gate/events/{eventId}/reservations',
} as const;

export const GATE_CREDENTIAL_ERROR_CODES = {
  CREDENTIAL_SIGNATURE_INVALID: 'CREDENTIAL_SIGNATURE_INVALID',
  CREDENTIAL_CONTEXT_MISMATCH: 'CREDENTIAL_CONTEXT_MISMATCH',
  CREDENTIAL_VERSION_STALE: 'CREDENTIAL_VERSION_STALE',
  CREDENTIAL_REQUIRED: 'CREDENTIAL_REQUIRED',
  MANUAL_CODE_INVALID: 'MANUAL_CODE_INVALID',
  MANUAL_PROOF_INVALID: 'MANUAL_PROOF_INVALID',
} as const;

/** Signed QR envelope returned with each owner ticket read. */
export interface GateCredentialEnvelope {
  v: 1;
  kind: 'ticket.gate_credential';
  jws: string;
}

/** The reserve API accepts only a signed QR or a server-minted manual proof. */
export type PresentedGateCredential =
  | { kind: 'qr'; jws: string }
  | { kind: 'manual'; proofToken: string };

export interface GateReserveRequestBody {
  tenantId: string;
  staffSessionId: string;
  presented: PresentedGateCredential;
}

export interface ManualLookupRequestBody {
  tenantId: string;
  staffSessionId: string;
  code: string;
}

export interface ManualLookupResponse {
  ticketId: string;
  proofToken: string;
  expiresAt: string;
}

export interface TicketGateCredentialView {
  gateCredential: GateCredentialEnvelope;
  manualEntryCode: string | null;
}
