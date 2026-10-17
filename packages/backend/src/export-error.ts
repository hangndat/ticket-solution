export const EXPORT_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EXPORT_NOT_FOUND: 'EXPORT_NOT_FOUND',
  EXPORT_NOT_READY: 'EXPORT_NOT_READY',
  EXPORT_EXPIRED: 'EXPORT_EXPIRED',
  MINIO_MISCONFIGURED: 'MINIO_MISCONFIGURED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_FILTER: 'INVALID_FILTER',
} as const;

export type ExportErrorCode =
  (typeof EXPORT_ERROR_CODES)[keyof typeof EXPORT_ERROR_CODES];

export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}
