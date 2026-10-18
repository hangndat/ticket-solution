import { IMPORT_ERROR_CODES, type ImportErrorCode } from '@ticket/contracts';

export { IMPORT_ERROR_CODES, type ImportErrorCode };

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly httpStatus: number;

  constructor(
    code: ImportErrorCode,
    message: string,
    httpStatus: number = 422,
  ) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function importErrorHttpStatus(code: ImportErrorCode): number {
  switch (code) {
    case IMPORT_ERROR_CODES.EVENT_NOT_FOUND:
    case IMPORT_ERROR_CODES.IMPORT_NOT_FOUND:
    case IMPORT_ERROR_CODES.INVITATION_NOT_FOUND:
      return 404;
    case IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH:
    case IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED:
      return 403;
    case IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT:
      return 409;
    case IMPORT_ERROR_CODES.INVITATION_EXPIRED:
    case IMPORT_ERROR_CODES.INVITATION_REVOKED:
    case IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID:
      return 410;
    case IMPORT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED:
      return 400;
    default:
      return 422;
  }
}
