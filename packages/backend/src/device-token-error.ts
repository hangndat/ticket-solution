export const DEVICE_TOKEN_ERROR_CODES = {
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  INVALID_ENVIRONMENT: 'INVALID_ENVIRONMENT',
  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',
  APNS_MISCONFIGURED: 'APNS_MISCONFIGURED',
} as const;

export type DeviceTokenErrorCode =
  (typeof DEVICE_TOKEN_ERROR_CODES)[keyof typeof DEVICE_TOKEN_ERROR_CODES];

export class DeviceTokenError extends Error {
  readonly code: DeviceTokenErrorCode;

  constructor(code: DeviceTokenErrorCode, message: string) {
    super(message);
    this.name = 'DeviceTokenError';
    this.code = code;
  }
}
