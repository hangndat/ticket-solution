import {
  APPROVAL_PENDING,
  type FormAnswerValue,
  type InvitationClaimBody,
} from './contract.ts';
import {
  PENDING_NOT_TICKET,
  REDEEM_UNKNOWN,
  type RedeemDecision,
} from './redeem-client.ts';

export type ClaimDecision = RedeemDecision;

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function buildClaimBody(input: {
  token: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
}): InvitationClaimBody {
  const body: InvitationClaimBody = { token: input.token };
  if (input.formVersion?.trim()) body.formVersion = input.formVersion.trim();
  if (input.termsVersion?.trim()) body.termsVersion = input.termsVersion.trim();
  if (input.answers && Object.keys(input.answers).length > 0) {
    body.answers = input.answers;
  }
  if (input.termsAccepted === true) body.termsAccepted = true;
  return body;
}

/**
 * Verified guest claim — reuses issue/pending decision shape.
 * Wrong-email / expired / revoked map to denied with safe codes (no email echo).
 */
export async function claimInvitation(input: {
  apiBase: string;
  bearer: string;
  tenantId: string;
  eventId: string;
  token: string;
  idempotencyKey: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ClaimDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  try {
    const response = await fetchImpl(
      `${base}/v1/tenants/${input.tenantId}/events/${input.eventId}/invitations/claim`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${input.bearer}`,
          'Content-Type': 'application/json',
          'idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify(
          buildClaimBody({
            token: input.token,
            formVersion: input.formVersion,
            termsVersion: input.termsVersion,
            answers: input.answers,
            termsAccepted: input.termsAccepted,
          }),
        ),
      },
    );
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    if (response.status === 0 || response.status >= 500) {
      return {
        kind: 'unknown',
        idempotencyKey: input.idempotencyKey,
        message: REDEEM_UNKNOWN,
      };
    }
    const body = record(json);
    if (
      body &&
      body.code === APPROVAL_PENDING &&
      typeof body.requestId === 'string'
    ) {
      return {
        kind: 'pending',
        requestId: body.requestId,
        operationId:
          typeof body.operationId === 'string' ? body.operationId : '',
        eventId: typeof body.eventId === 'string' ? body.eventId : input.eventId,
        expiresAt:
          typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
        replayed: body.replayed === true,
        message: PENDING_NOT_TICKET,
      };
    }
    if (
      (response.status === 200 || response.status === 201) &&
      body &&
      typeof body.ticketId === 'string' &&
      body.state === 'ACTIVE'
    ) {
      return {
        kind: 'issued',
        ticketId: body.ticketId,
        requestId:
          typeof body.requestId === 'string' ? body.requestId : undefined,
        replayed: body.replayed === true,
      };
    }
    if (
      body &&
      (body.code === 'FORM_VERSION_STALE' || body.code === 'TERMS_VERSION_STALE')
    ) {
      return {
        kind: 'stale',
        code: String(body.code),
        message:
          typeof body.message === 'string'
            ? body.message
            : 'Published form or terms changed — reload and reconsent.',
      };
    }
    if (body && typeof body.code === 'string') {
      return {
        kind: 'denied',
        code: body.code,
        message:
          typeof body.message === 'string'
            ? body.message
            : 'Invitation claim was rejected.',
      };
    }
    return {
      kind: 'unknown',
      idempotencyKey: input.idempotencyKey,
      message: REDEEM_UNKNOWN,
    };
  } catch {
    return {
      kind: 'unknown',
      idempotencyKey: input.idempotencyKey,
      message: REDEEM_UNKNOWN,
    };
  }
}
