import QRCode from 'qrcode';
import { hashCredentialToken, openCredentialToken } from './credential-crypto';

export type TicketGateCredentialQrPayload = {
  v: 1;
  kind: 'ticket.gate_credential';
  jws: string;
};

/** @deprecated Legacy fixture/tooling payload; the worker email relay uses the signed Gate envelope. */
export type TicketCredentialQrPayload = {
  v: 1;
  kind: 'ticket.credential';
  ticketId: string;
  tenantId: string;
  eventId: string;
  credentialVersion: number;
  token: string;
};

export function buildGateCredentialQrJson(jws: string): string {
  if (!jws.trim()) throw new Error('gate credential JWS is required');
  const payload: TicketGateCredentialQrPayload = {
    v: 1,
    kind: 'ticket.gate_credential',
    jws,
  };
  return JSON.stringify(payload);
}

export async function renderGateCredentialQrPng(jws: string): Promise<Buffer> {
  const value = buildGateCredentialQrJson(jws);
  return QRCode.toBuffer(value, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
}

/** @deprecated Legacy fixture/tooling only; never use this payload as Gate proof. */
export function buildCredentialQrJson(
  input: Omit<TicketCredentialQrPayload, 'v' | 'kind'>,
): string {
  const payload: TicketCredentialQrPayload = {
    v: 1,
    kind: 'ticket.credential',
    ...input,
  };
  return JSON.stringify(payload);
}

/** @deprecated Legacy fixture/tooling only; worker email relay uses renderGateCredentialQrPng. */
export async function renderCredentialQrPng(
  input: Omit<TicketCredentialQrPayload, 'v' | 'kind'>,
): Promise<Buffer> {
  return QRCode.toBuffer(buildCredentialQrJson(input), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
}

/** @deprecated Legacy fixture/tooling only; never use the opened token as Gate proof. */
export function openCurrentCredentialForQr(input: {
  encryptedToken: string;
  credentialKeyMaterial: string;
  expectedTokenHash: string;
}): { token: string; tokenHash: string } {
  const token = openCredentialToken(input.encryptedToken, input.credentialKeyMaterial);
  const tokenHash = hashCredentialToken(token);
  if (tokenHash !== input.expectedTokenHash) {
    throw new Error('credential token hash mismatch');
  }
  return { token, tokenHash };
}

/** @deprecated Import from `./web-links` — re-exported for existing callers. */
export { buildOwnerTicketLink } from './web-links';
