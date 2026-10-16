export const CONFIG_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_CLOSED: 'EVENT_CLOSED',
  CONFIG_PAYLOAD_REQUIRED: 'CONFIG_PAYLOAD_REQUIRED',
  CONFIG_VERSION_NOT_FOUND: 'CONFIG_VERSION_NOT_FOUND',
  CONFIG_VERSION_MISMATCH: 'CONFIG_VERSION_MISMATCH',
  ALREADY_PUBLISHED: 'ALREADY_PUBLISHED',
} as const;

export type ConfigErrorCode =
  (typeof CONFIG_ERROR_CODES)[keyof typeof CONFIG_ERROR_CODES];

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;

  constructor(code: ConfigErrorCode, message: string) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
  }
}
