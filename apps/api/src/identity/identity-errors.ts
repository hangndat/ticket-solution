import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { ApiError } from '@ticket/contracts';
import { IdentityError } from '@ticket/backend';
import { identityErrorHttpStatus } from '../identity-http-status';

export function toHttpException(error: IdentityError): HttpException {
  const requestId = randomUUID();
  const body: ApiError = {
    code: error.code,
    message: error.message,
    requestId,
    retryable: error.retryable,
  };
  return new HttpException(body, identityErrorHttpStatus(error.code));
}
