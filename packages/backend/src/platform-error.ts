import { PLATFORM_ERROR_CODES, type PlatformErrorCode } from '@ticket/contracts';

export { PLATFORM_ERROR_CODES, type PlatformErrorCode };

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  readonly retryable: boolean;
  constructor(
    code: PlatformErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.retryable = retryable;
  }
}
