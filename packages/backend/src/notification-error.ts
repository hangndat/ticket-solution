import { NOTIFICATION_ERROR_CODES } from '@ticket/contracts';

export { NOTIFICATION_ERROR_CODES };

export type NotificationErrorCode =
  (typeof NOTIFICATION_ERROR_CODES)[keyof typeof NOTIFICATION_ERROR_CODES];

export class NotificationError extends Error {
  readonly code: NotificationErrorCode;
  readonly retryable: boolean;

  constructor(
    code: NotificationErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.retryable = retryable;
  }
}
