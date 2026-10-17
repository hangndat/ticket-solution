/** Shared transport primitives for frozen feature contracts (C-E…C-N). */

/** Cursor pagination: opaque cursor, limit clamped server-side. */
export const CURSOR_PAGE_LIMIT = {
  min: 1,
  max: 100,
  default: 20,
} as const;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** HTTP header name for mutation idempotency (UUID client key). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key' as const;

/** Field-level validation error (forms / CSV rows). Never echoes secrets or PII. */
export interface FieldValidationError {
  fieldId: string;
  code: string;
  message: string;
}

export interface ApiErrorWithFields {
  code: string;
  message: string;
  requestId: string;
  operationId?: string;
  retryable: boolean;
  fields?: FieldValidationError[];
}
