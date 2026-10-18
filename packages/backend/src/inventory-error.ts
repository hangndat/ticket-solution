export const INVENTORY_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_CLOSED: 'EVENT_CLOSED',
  CODES_REQUIRED: 'CODES_REQUIRED',
  CODE_DUPLICATE: 'CODE_DUPLICATE',
  QUOTA_REQUIRED: 'QUOTA_REQUIRED',
  IMPORT_TOO_LARGE: 'IMPORT_TOO_LARGE',
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_INPUT: 'INVALID_INPUT',
} as const;

export type InventoryErrorCode =
  (typeof INVENTORY_ERROR_CODES)[keyof typeof INVENTORY_ERROR_CODES];

export class InventoryError extends Error {
  readonly code: InventoryErrorCode;

  constructor(code: InventoryErrorCode, message: string) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
  }
}
