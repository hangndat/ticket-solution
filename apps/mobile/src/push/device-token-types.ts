/**
 * Mirrors BE `@ticket/contracts` DeviceToken* types (PR #52 wire).
 * Shared contracts package on this branch does not yet export them —
 * keep shapes identical to packages/contracts DeviceTokenRegisterBody /
 * DeviceTokenRegistration until coordinator merges BE contracts.
 */

export type DeviceTokenEnvironment = 'sandbox' | 'production';

export type DeviceTokenRegisterBody = {
  token: string;
  environment: DeviceTokenEnvironment;
};

export type DeviceTokenRegistration = {
  registrationId: string;
  environment: DeviceTokenEnvironment;
  /** ISO timestamp when the registration became active. */
  registeredAt: string;
};

export const DEVICE_TOKEN_ERROR_CODES = {
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  INVALID_ENVIRONMENT: 'INVALID_ENVIRONMENT',
  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',
  APNS_MISCONFIGURED: 'APNS_MISCONFIGURED',
} as const;

export type LocalDeviceRegistration = {
  registrationId: string;
  environment: DeviceTokenEnvironment;
  userId: string;
};
