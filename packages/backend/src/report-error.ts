export const REPORT_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_INPUT: 'INVALID_INPUT',
} as const;

export type ReportErrorCode =
  (typeof REPORT_ERROR_CODES)[keyof typeof REPORT_ERROR_CODES];

export class ReportError extends Error {
  readonly code: ReportErrorCode;

  constructor(code: ReportErrorCode, message: string) {
    super(message);
    this.name = 'ReportError';
    this.code = code;
  }
}
