import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import type { IdentityErrorCode } from '@ticket/backend';

export function identityErrorHttpStatus(code: IdentityErrorCode): number {
  if (
    code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED ||
    code === IDENTITY_ERROR_CODES.OIDC_UNAVAILABLE
  ) {
    return 503;
  }
  if (code === IDENTITY_ERROR_CODES.EMAIL_NOT_VERIFIED) return 403;
  if (code === IDENTITY_ERROR_CODES.UNAUTHENTICATED) return 401;
  return 401;
}
