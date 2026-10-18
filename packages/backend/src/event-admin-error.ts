export const EVENT_ADMIN_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  INVALID_WINDOW: 'INVALID_WINDOW',
  TICKET_TYPE_NOT_FOUND: 'TICKET_TYPE_NOT_FOUND',
  INVALID_APPROVAL_MODE: 'INVALID_APPROVAL_MODE',
  INVALID_CURSOR: 'INVALID_CURSOR',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type EventAdminErrorCode =
  (typeof EVENT_ADMIN_ERROR_CODES)[keyof typeof EVENT_ADMIN_ERROR_CODES];

export class EventAdminError extends Error {
  readonly code: EventAdminErrorCode;

  constructor(code: EventAdminErrorCode, message: string) {
    super(message);
    this.name = 'EventAdminError';
    this.code = code;
  }
}
