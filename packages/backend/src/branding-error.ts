/**
 * Tenant branding error codes (D8-S1).
 */
export const BRANDING_ERROR_CODES = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  STALE_VERSION: 'STALE_VERSION',
} as const;

export type BrandingErrorCode =
  (typeof BRANDING_ERROR_CODES)[keyof typeof BRANDING_ERROR_CODES];

export class BrandingError extends Error {
  readonly code: BrandingErrorCode;
  readonly retryable: boolean;

  constructor(code: BrandingErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'BrandingError';
    this.code = code;
    this.retryable = retryable;
  }
}
