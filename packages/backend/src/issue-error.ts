/** Stable business error codes for redemption / issue (D2). */
export const ISSUE_ERROR_CODES = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  CODE_INVALID: 'CODE_INVALID',
  CODE_CONSUMED: 'CODE_CONSUMED',
  CODE_DISABLED: 'CODE_DISABLED',
  EVENT_CLOSED: 'EVENT_CLOSED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_ARCHIVED: 'EVENT_ARCHIVED',
  REDEMPTION_WINDOW_CLOSED: 'REDEMPTION_WINDOW_CLOSED',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  ATTENDEE_LIMIT: 'ATTENDEE_LIMIT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  RETRYABLE_CONFLICT: 'RETRYABLE_CONFLICT',
  CODE_HMAC_MISCONFIGURED: 'CODE_HMAC_MISCONFIGURED',
} as const;

export type IssueErrorCode =
  (typeof ISSUE_ERROR_CODES)[keyof typeof ISSUE_ERROR_CODES];

/** Fail-closed issue/redemption failures. Never treat as successful issue. */
export class IssueError extends Error {
  readonly code: IssueErrorCode;
  readonly retryable: boolean;

  constructor(code: IssueErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'IssueError';
    this.code = code;
    this.retryable = retryable;
  }
}
