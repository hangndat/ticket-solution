/**
 * Ownership mirror of packages/contracts C-F / C-I redeem+claim shapes
 * (hangndat/d4-contracts-feature-freeze). Do not invent aliases — keep
 * command/status literals aligned with shared freeze until root lands packages.
 */

/** Shared operation command — must match BE `REDEEM_COMMAND`. */
export const REDEEM_COMMAND = 'redemption.redeem' as const;

export const INVITATION_CLAIM_COMMAND = 'invitation.claim' as const;

export const APPROVAL_PENDING = 'APPROVAL_PENDING' as const;

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'select'
  | 'checkbox';

export const FORM_LIMITS = {
  maxFields: 50,
  maxFieldIdLength: 64,
  maxLabelLength: 200,
  maxTextLength: 2000,
  maxEmailLength: 254,
  phoneMinLength: 3,
  phoneMaxLength: 32,
  maxSelectOptions: 50,
} as const;

export type FormSelectOption = { id: string; label: string };

export type FormFieldDefinition = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormSelectOption[];
};

export type FormDefinition = {
  formVersion: string;
  fields: FormFieldDefinition[];
};

export type FormAnswerValue = string | boolean;

/** Additive redeem body (C-F). */
export type RedeemRequestBody = {
  code: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: true;
};

export type RedeemPendingResponse = {
  code: typeof APPROVAL_PENDING;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  status: 'PENDING_REVIEW';
  expiresAt?: string;
  replayed: boolean;
};

export type RedeemIssuedResult = {
  ticketId: string;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: 'ACTIVE';
  credentialVersion: number;
  replayed: boolean;
};

export type OwnerRedemptionStatus =
  | {
      status: 'PENDING_REVIEW';
      requestId: string;
      eventId: string;
      ticketTypeId: string;
      sourceId: string;
      expiresAt: string | null;
      submittedAt: string;
    }
  | {
      status: 'ISSUED';
      requestId: string;
      eventId: string;
      ticketId: string;
      ticketTypeId: string;
      sourceId: string;
      issuedAt: string;
    }
  | {
      status: 'REJECTED';
      requestId: string;
      eventId: string;
      ticketTypeId: string;
      sourceId: string;
      reason: string | null;
      decidedAt: string;
    }
  | {
      status: 'EXPIRED';
      requestId: string;
      eventId: string;
      ticketTypeId: string;
      sourceId: string;
      expiredAt: string;
    };

export type InvitationClaimBody = {
  token: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: true;
};

export const FORM_ERROR_CODES = {
  FORM_REQUIRED: 'FORM_REQUIRED',
  FORM_INVALID: 'FORM_INVALID',
  FORM_VERSION_STALE: 'FORM_VERSION_STALE',
  TERMS_REQUIRED: 'TERMS_REQUIRED',
  TERMS_VERSION_STALE: 'TERMS_VERSION_STALE',
  PENDING_EXPIRED: 'PENDING_EXPIRED',
  PENDING_LIMIT: 'PENDING_LIMIT',
  REDEMPTION_NOT_FOUND: 'REDEMPTION_NOT_FOUND',
} as const;

export const INVITATION_ERROR_CODES = {
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_EMAIL_MISMATCH: 'INVITATION_EMAIL_MISMATCH',
  INVITATION_TOKEN_INVALID: 'INVITATION_TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
} as const;
