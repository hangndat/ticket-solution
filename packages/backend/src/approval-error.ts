/** Stable business error codes for manual redemption review (D4). */
export const APPROVAL_ERROR_CODES = {
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  DECISION_CONFLICT: 'DECISION_CONFLICT',
  CODE_NOT_HELD: 'CODE_NOT_HELD',
  EVENT_CLOSED: 'EVENT_CLOSED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_ARCHIVED: 'EVENT_ARCHIVED',
  REDEMPTION_WINDOW_CLOSED: 'REDEMPTION_WINDOW_CLOSED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  ATTENDEE_LIMIT: 'ATTENDEE_LIMIT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  REASON_REQUIRED: 'REASON_REQUIRED',
  REASON_TOO_LONG: 'REASON_TOO_LONG',
  RETRYABLE_CONFLICT: 'RETRYABLE_CONFLICT',
  PENDING_EXPIRED: 'PENDING_EXPIRED',
} as const;

export type ApprovalErrorCode =
  (typeof APPROVAL_ERROR_CODES)[keyof typeof APPROVAL_ERROR_CODES];

/** Fail-closed review failures. Never treat as an approved ticket. */
export class ApprovalError extends Error {
  readonly code: ApprovalErrorCode;
  readonly retryable: boolean;

  constructor(code: ApprovalErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'ApprovalError';
    this.code = code;
    this.retryable = retryable;
  }
}
