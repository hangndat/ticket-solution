import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { CURSOR_PAGE_LIMIT, type ApiError } from '@ticket/contracts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validationError(
  code: string,
  message: string,
  status = 422,
): HttpException {
  return new HttpException(
    {
      code,
      message,
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    status,
  );
}

export function requireUuidParam(
  value: string | undefined,
  name: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (!UUID_RE.test(trimmed)) {
    throw validationError('INVALID_UUID', `${name} must be a UUID`);
  }
  return trimmed;
}

/**
 * Optional positive integer query param; rejects decimals, negatives, and non-numeric strings.
 */
export function parseOptionalLimitQuery(
  raw: string | undefined,
  name = 'limit',
): number | undefined {
  if (raw == null || raw === '') return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw validationError('INVALID_LIMIT', `${name} must be a positive integer`);
  }
  const n = Number.parseInt(trimmed, 10);
  if (n < CURSOR_PAGE_LIMIT.min || n > CURSOR_PAGE_LIMIT.max) {
    throw validationError(
      'INVALID_LIMIT',
      `${name} must be between ${CURSOR_PAGE_LIMIT.min} and ${CURSOR_PAGE_LIMIT.max}`,
    );
  }
  return n;
}
