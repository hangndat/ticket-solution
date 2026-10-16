/** Stable authorization failure codes (D1 membership). Not identity codes. */
export const AUTHZ_ERROR_CODES = {
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  MEMBERSHIP_REVOKED: 'MEMBERSHIP_REVOKED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  EVENT_ASSIGNMENT_REQUIRED: 'EVENT_ASSIGNMENT_REQUIRED',
} as const;

export type AuthzErrorCode =
  (typeof AUTHZ_ERROR_CODES)[keyof typeof AUTHZ_ERROR_CODES];

/** Fail-closed authorization failures. Never treat as authorized success. */
export class AuthzError extends Error {
  readonly code: AuthzErrorCode;
  readonly retryable: boolean;

  constructor(code: AuthzErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'AuthzError';
    this.code = code;
    this.retryable = retryable;
  }
}
