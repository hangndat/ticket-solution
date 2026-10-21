import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { type ApiError, PLATFORM_ERROR_CODES } from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  PlatformError,
} from '@ticket/backend';
import { identityErrorHttpStatus } from '../identity-http-status';

export function platformRouteFail(error: unknown): never {
  if (error instanceof PlatformError) {
    const status =
      error.code === PLATFORM_ERROR_CODES.UNAUTHENTICATED ||
      error.code === PLATFORM_ERROR_CODES.MFA_REQUIRED
        ? 401
        : error.code === PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED ||
            error.code === PLATFORM_ERROR_CODES.PERMISSION_DENIED ||
            error.code === PLATFORM_ERROR_CODES.MEMBERSHIP_REVOKED ||
            error.code === PLATFORM_ERROR_CODES.MEMBERSHIP_REQUIRED
          ? 403
          : error.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND
            ? 404
            : error.code === PLATFORM_ERROR_CODES.SLUG_TAKEN ||
                error.code === PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
                error.code === PLATFORM_ERROR_CODES.STALE_VERSION ||
                error.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED ||
                error.code === PLATFORM_ERROR_CODES.LIMIT_BELOW_USAGE ||
                error.code === PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED ||
                error.code === PLATFORM_ERROR_CODES.INVITE_ALREADY_USED
              ? 409
              : error.code === PLATFORM_ERROR_CODES.RATE_LIMITED
                ? 429
                : error.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED ||
                    error.code === PLATFORM_ERROR_CODES.TENANT_PENDING
                  ? 503
                  : 422;
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: error.retryable,
      } satisfies ApiError,
      status,
    );
  }
  if (error instanceof AuthzError) {
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: false,
      } satisfies ApiError,
      403,
    );
  }
  if (error instanceof IdentityError) {
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: error.retryable,
      } satisfies ApiError,
      identityErrorHttpStatus(error.code),
    );
  }
  throw error;
}
