import {
  APPROVAL_PENDING,
  FORM_ERROR_CODES,
  type FieldValidationError,
} from '@ticket/contracts';

export const REDEEM_UNKNOWN =
  'Redeem result is unknown. Do not treat this as a ticket. Reconcile the same idempotency key.';

export const PENDING_NOT_TICKET =
  'Waiting for staff review. No ticket and no seat guarantee until approved.';

export type RedeemDecision =
  | {
      kind: 'issued';
      ticketId: string;
      requestId?: string;
      operationId?: string;
      replayed: boolean;
    }
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
  | { kind: 'expired'; code: string; message: string }
  | { kind: 'stale'; code: string; message: string }
  | {
      kind: 'field_errors';
      code: string;
      message: string;
      fields: FieldValidationError[];
    }
  | { kind: 'unknown'; idempotencyKey: string; message: string };

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

function fieldsFrom(body: Record<string, unknown>): FieldValidationError[] {
  if (!Array.isArray(body.fields)) return [];
  const out: FieldValidationError[] = [];
  for (const item of body.fields) {
    const row = record(item);
    if (!row) continue;
    if (
      typeof row.fieldId === 'string' &&
      typeof row.code === 'string' &&
      typeof row.message === 'string'
    ) {
      out.push({
        fieldId: row.fieldId,
        code: row.code,
        message: row.message,
      });
    }
  }
  return out;
}

/**
 * Discriminated redeem outcome — never treat pending/timeout as issued ticket.
 */
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
      operationId:
        typeof body.operationId === 'string' ? body.operationId : undefined,
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
        operationId:
          typeof nested.operationId === 'string'
            ? nested.operationId
            : undefined,
        replayed: nested.replayed === true,
      };
    }
    if (typeof nested.code === 'string' && nested.code !== APPROVAL_PENDING) {
      return decideErrorCode(
        nested.code,
        typeof nested.message === 'string' ? nested.message : 'Redeem was rejected.',
        fieldsFrom(nested),
      );
    }
  }

  if (body.status === 'FAILED' && nested && typeof nested.code === 'string') {
    return decideErrorCode(
      nested.code,
      typeof nested.message === 'string' ? nested.message : 'Redeem failed.',
      fieldsFrom(nested),
    );
  }

  if (typeof body.code === 'string' && body.code !== APPROVAL_PENDING) {
    return decideErrorCode(
      body.code,
      typeof body.message === 'string' ? body.message : 'Redeem was rejected.',
      fieldsFrom(body),
    );
  }

  return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
}

function decideErrorCode(
  code: string,
  message: string,
  fields: FieldValidationError[],
): RedeemDecision {
  if (
    code === FORM_ERROR_CODES.FORM_VERSION_STALE ||
    code === FORM_ERROR_CODES.TERMS_VERSION_STALE
  ) {
    return { kind: 'stale', code, message };
  }
  if (code === FORM_ERROR_CODES.PENDING_EXPIRED) {
    return { kind: 'expired', code, message };
  }
  if (
    (code === FORM_ERROR_CODES.FORM_INVALID ||
      code === FORM_ERROR_CODES.FORM_REQUIRED ||
      code === FORM_ERROR_CODES.TERMS_REQUIRED) &&
    fields.length > 0
  ) {
    return { kind: 'field_errors', code, message, fields };
  }
  return { kind: 'denied', code, message };
}
