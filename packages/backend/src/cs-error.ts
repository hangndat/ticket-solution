export const CS_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  QUERY_TOO_LONG: 'QUERY_TOO_LONG',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  RESEND_LIMIT: 'RESEND_LIMIT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type CsErrorCode = (typeof CS_ERROR_CODES)[keyof typeof CS_ERROR_CODES];

export class CsError extends Error {
  readonly code: CsErrorCode;

  constructor(code: CsErrorCode, message: string) {
    super(message);
    this.name = 'CsError';
    this.code = code;
  }
}
