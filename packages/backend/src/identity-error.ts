import { IDENTITY_ERROR_CODES } from '@ticket/contracts';

export type IdentityErrorCode =
  (typeof IDENTITY_ERROR_CODES)[keyof typeof IDENTITY_ERROR_CODES];

/** Fail-closed identity failures. Never treat as authenticated success. */
export class IdentityError extends Error {
  readonly code: IdentityErrorCode;
  readonly retryable: boolean;

  constructor(
    code: IdentityErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.retryable = retryable;
  }
}

export { IDENTITY_ERROR_CODES };
