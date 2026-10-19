import { REDEMPTION_RESOLVE_HEADER } from '@ticket/contracts';
import {
  APPROVAL_PENDING,
  REDEEM_COMMAND,
  type FormAnswerValue,
  type RedeemRequestBody,
} from './contract.ts';

export const REDEEM_UNKNOWN =
  'Redeem result is unknown. Do not treat this as a ticket. Reconcile the same idempotency key.';

export const PENDING_NOT_TICKET =
  'Waiting for staff review. No ticket and no seat guarantee until approved.';

export type RedeemDecision =
  | { kind: 'issued'; ticketId: string; requestId?: string; replayed: boolean }
  | {
      kind: 'pending';
      requestId: string;
      operationId: string;
      eventId: string;
      expiresAt?: string;
      replayed: boolean;
      message: string;
    }
  | { kind: 'denied'; code: string; message: string }
  | { kind: 'stale'; code: string; message: string }
  | { kind: 'unknown'; idempotencyKey: string; message: string };

type FetchResult = {
  status: number;
  json: unknown;
  networkError: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function isPendingBody(body: Record<string, unknown>): boolean {
  return (
    body.code === APPROVAL_PENDING &&
    body.status === 'PENDING_REVIEW' &&
    typeof body.requestId === 'string' &&
    body.requestId.length > 0
  );
}

function pendingDecision(
  body: Record<string, unknown>,
  replayedFallback = false,
): RedeemDecision {
  return {
    kind: 'pending',
    requestId: String(body.requestId),
    operationId:
      typeof body.operationId === 'string' ? body.operationId : '',
    eventId: typeof body.eventId === 'string' ? body.eventId : '',
    expiresAt:
      typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
    replayed: body.replayed === true || replayedFallback,
    message: PENDING_NOT_TICKET,
  };
}

export function decideRedeemBody(
  status: number,
  json: unknown,
  idempotencyKey: string,
  networkError = false,
): RedeemDecision {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
  }
  const body = record(json);
  if (!body) {
    return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
  }

  // Direct pending hold (200/201 or business body)
  if (isPendingBody(body)) {
    return pendingDecision(body);
  }

  if (
    (status === 200 || status === 201) &&
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

  const nested = record(body.response);
  if (body.status === 'COMPLETED' && nested) {
    if (isPendingBody(nested)) {
      return pendingDecision(nested, true);
    }
    if (nested.state === 'ACTIVE' && typeof nested.ticketId === 'string') {
      return {
        kind: 'issued',
        ticketId: nested.ticketId,
        requestId:
          typeof nested.requestId === 'string' ? nested.requestId : undefined,
        replayed: nested.replayed === true,
      };
    }
    if (typeof nested.code === 'string' && nested.code !== APPROVAL_PENDING) {
      return {
        kind: 'denied',
        code: nested.code,
        message:
          typeof nested.message === 'string'
            ? nested.message
            : 'Redeem was rejected.',
      };
    }
  }

  if (body.status === 'IN_PROGRESS' || body.status === 'FAILED') {
    return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
  }

  if (typeof body.code === 'string') {
    if (
      body.code === 'FORM_VERSION_STALE' ||
      body.code === 'TERMS_VERSION_STALE'
    ) {
      return {
        kind: 'stale',
        code: body.code,
        message:
          typeof body.message === 'string'
            ? body.message
            : 'Published form or terms changed — reload and reconsent.',
      };
    }
    // Never treat APPROVAL_PENDING as denied/ticket
    if (body.code === APPROVAL_PENDING) {
      if (isPendingBody(body)) return pendingDecision(body);
      return {
        kind: 'pending',
        requestId:
          typeof body.requestId === 'string' ? body.requestId : '',
        operationId:
          typeof body.operationId === 'string' ? body.operationId : '',
        eventId: typeof body.eventId === 'string' ? body.eventId : '',
        replayed: body.replayed === true,
        message: PENDING_NOT_TICKET,
      };
    }
    return {
      kind: 'denied',
      code: body.code,
      message:
        typeof body.message === 'string' ? body.message : 'Redeem was rejected.',
    };
  }

  return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<FetchResult> {
  try {
    const response = await fetchImpl(url, init);
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    return { status: response.status, json, networkError: false };
  } catch {
    return { status: 0, json: null, networkError: true };
  }
}

function buildRedeemBody(input: {
  code: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
}): RedeemRequestBody {
  const body: RedeemRequestBody = { code: input.code };
  if (input.formVersion?.trim()) body.formVersion = input.formVersion.trim();
  if (input.termsVersion?.trim()) body.termsVersion = input.termsVersion.trim();
  if (input.answers && Object.keys(input.answers).length > 0) {
    body.answers = input.answers;
  }
  if (input.termsAccepted === true) body.termsAccepted = true;
  return body;
}

export async function redeemCode(input: {
  apiBase: string;
  bearer: string;
  tenantId: string;
  eventId: string;
  code: string;
  idempotencyKey: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
  /** Required for global resolve flow — binds issue to resolve token. */
  resolveToken?: string;
  fetchImpl?: typeof fetch;
}): Promise<RedeemDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const resolveToken = input.resolveToken?.trim();
  const posted = await readJson(
    fetchImpl,
    `${base}/v1/tenants/${input.tenantId}/events/${input.eventId}/redemptions`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
        'Content-Type': 'application/json',
        'idempotency-key': input.idempotencyKey,
        ...(resolveToken
          ? { [REDEMPTION_RESOLVE_HEADER]: resolveToken }
          : {}),
      },
      body: JSON.stringify(
        buildRedeemBody({
          code: input.code,
          formVersion: input.formVersion,
          termsVersion: input.termsVersion,
          answers: input.answers,
          termsAccepted: input.termsAccepted,
        }),
      ),
    },
  );
  const decision = decideRedeemBody(
    posted.status,
    posted.json,
    input.idempotencyKey,
    posted.networkError,
  );
  if (decision.kind !== 'unknown') return decision;
  return reconcileRedeem({ ...input, fetchImpl });
}

export async function reconcileRedeem(input: {
  apiBase: string;
  bearer: string;
  tenantId: string;
  eventId: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<RedeemDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const url = new URL(`${base}/v1/operations/${input.idempotencyKey}`);
  url.searchParams.set('tenantId', input.tenantId);
  url.searchParams.set('eventId', input.eventId);
  url.searchParams.set('command', REDEEM_COMMAND);
  const result = await readJson(fetchImpl, url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.bearer}`,
    },
  });
  return decideRedeemBody(
    result.status,
    result.json,
    input.idempotencyKey,
    result.networkError,
  );
}

export { REDEEM_COMMAND };
