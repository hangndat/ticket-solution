import QRCode from 'qrcode';
import {
  hashCredentialToken,
  openCredentialToken,
} from './credential-crypto';

export type TicketCredentialQrPayload = {
  v: 1;
  kind: 'ticket.credential';
  ticketId: string;
  tenantId: string;
  eventId: string;
  credentialVersion: number;
  /** Opaque current credential token — not a URL bearer. */
  token: string;
};

export function buildCredentialQrJson(
  input: Omit<TicketCredentialQrPayload, 'v' | 'kind'>,
): string {
  const payload: TicketCredentialQrPayload = {
    v: 1,
    kind: 'ticket.credential',
    ticketId: input.ticketId,
    tenantId: input.tenantId,
    eventId: input.eventId,
    credentialVersion: input.credentialVersion,
    token: input.token,
  };
  return JSON.stringify(payload);
}

export async function renderCredentialQrPng(
  input: Omit<TicketCredentialQrPayload, 'v' | 'kind'>,
): Promise<Buffer> {
  const value = buildCredentialQrJson(input);
  return QRCode.toBuffer(value, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
}

export function openCurrentCredentialForQr(input: {
  encryptedToken: string;
  credentialKeyMaterial: string;
  expectedTokenHash: string;
}): { token: string; tokenHash: string } {
  const token = openCredentialToken(
    input.encryptedToken,
    input.credentialKeyMaterial,
  );
  const tokenHash = hashCredentialToken(token);
  if (tokenHash !== input.expectedTokenHash) {
    throw new Error('credential token hash mismatch');
  }
  return { token, tokenHash };
}

/** @deprecated Import from `./web-links` — re-exported for existing callers. */
export { buildOwnerTicketLink } from './web-links';
