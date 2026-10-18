import type { FieldValidationError } from '@ticket/contracts';

/** Stable business error codes for redemption / issue (D2 + C-F). */
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
  FORM_REQUIRED: 'FORM_REQUIRED',
  FORM_INVALID: 'FORM_INVALID',
  FORM_VERSION_STALE: 'FORM_VERSION_STALE',
  TERMS_REQUIRED: 'TERMS_REQUIRED',
  TERMS_VERSION_STALE: 'TERMS_VERSION_STALE',
  PENDING_EXPIRED: 'PENDING_EXPIRED',
  PENDING_LIMIT: 'PENDING_LIMIT',
  REDEMPTION_NOT_FOUND: 'REDEMPTION_NOT_FOUND',
  /** Owner ticket read — missing or not owned (fail-closed 404). */
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
} as const;

export type IssueErrorCode =
  (typeof ISSUE_ERROR_CODES)[keyof typeof ISSUE_ERROR_CODES];

/** Fail-closed issue/redemption failures. Never treat as successful issue. */
export class IssueError extends Error {
  readonly code: IssueErrorCode;
  readonly retryable: boolean;
  readonly fields?: FieldValidationError[];

  constructor(
    code: IssueErrorCode,
    message: string,
    retryable = false,
    fields?: FieldValidationError[],
  ) {
    super(message);
    this.name = 'IssueError';
    this.code = code;
    this.retryable = retryable;
    this.fields = fields;
  }
}
