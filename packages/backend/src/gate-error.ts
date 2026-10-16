/** Stable business error codes for Gate reserve/confirm (D3). */
export const GATE_ERROR_CODES = {
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_NOT_ACTIVE: 'TICKET_NOT_ACTIVE',
  HELD_BY_OTHER_SESSION: 'HELD_BY_OTHER_SESSION',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  RESERVATION_TOKEN_MISMATCH: 'RESERVATION_TOKEN_MISMATCH',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  CHECKIN_NOT_FOUND: 'CHECKIN_NOT_FOUND',
  CHECKIN_ALREADY_UNDONE: 'CHECKIN_ALREADY_UNDONE',
} as const;

export type GateErrorCode =
  (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];

export class GateError extends Error {
  readonly code: GateErrorCode;

  constructor(code: GateErrorCode, message: string) {
    super(message);
    this.name = 'GateError';
    this.code = code;
  }
}
