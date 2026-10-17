/**
 * C-F — Form/consent, redeem body extensions, pending expiry, owner/staff status.
 */

import type { CursorPage, FieldValidationError } from './common';

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
  /** Digits/spaces/+()/.- after trim; prefix preserved (no country stripping). */
  phoneMinLength: 3,
  phoneMaxLength: 32,
  maxSelectOptions: 50,
} as const;

/** Technical defaults — configurable per source; not a customer SLA. */
export const PENDING_REVIEW_TTL_HOURS_DEFAULT = 24;
export const MAX_PENDING_PER_USER_EVENT_DEFAULT = 5;

export interface FormSelectOption {
  id: string;
  label: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormSelectOption[];
}

export interface FormDefinition {
  formVersion: string;
  fields: FormFieldDefinition[];
}

export type FormAnswerValue = string | boolean;

/**
 * Redeem mutation body (additive vs D2).
 * Canonical request hash MUST include normalized answers + termsAccepted.
 */
export interface RedeemRequestBodyV2 {
  code: string;
  formVersion?: string;
  termsVersion?: string;
  /** Map fieldId → value; unknown keys rejected. */
  answers?: Record<string, FormAnswerValue>;
  /** Explicit consent; must be true when terms required. */
  termsAccepted?: true;
}

/** MANUAL source hold — not a ticket; quota not allocated. */
export interface RedeemPendingResponse {
  code: 'APPROVAL_PENDING';
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  status: 'PENDING_REVIEW';
  expiresAt?: string;
  replayed: boolean;
}

/** Issued ticket outcome (same shape as RedeemResponse). */
export interface RedeemIssuedResult {
  ticketId: string;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: 'ACTIVE';
  credentialVersion: number;
  replayed: boolean;
}

export type RedeemMutationResult = RedeemIssuedResult | RedeemPendingResponse;

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
      /** Safe display reason — no PII / no owner identity of other parties. */
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

export interface StaffPendingRedemptionItem {
  requestId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  status: 'PENDING_REVIEW';
  expiresAt: string | null;
  submittedAt: string;
  /** Masked only — never raw email in list. */
  actorEmailMasked: string | null;
}

export type StaffPendingRedemptionPage = CursorPage<StaffPendingRedemptionItem>;

export interface FormValidationErrorBody {
  code: 'FORM_INVALID' | 'FORM_REQUIRED' | 'FORM_VERSION_STALE' | 'TERMS_VERSION_STALE' | 'TERMS_REQUIRED';
  message: string;
  requestId: string;
  retryable: false;
  fields?: FieldValidationError[];
}

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

export type FormErrorCode =
  (typeof FORM_ERROR_CODES)[keyof typeof FORM_ERROR_CODES];

/** Stable code returned on pending hold (also used as HTTP business code). */
export const APPROVAL_PENDING = 'APPROVAL_PENDING' as const;

export const REDEMPTION_ENDPOINTS = {
  redeem: 'POST /tenants/:tenantId/events/:eventId/redemptions',
  ownerStatus: 'GET /me/redemptions/:requestId',
  staffPending:
    'GET /tenants/:tenantId/events/:eventId/redemptions?status=PENDING_REVIEW',
  approve: 'POST /tenants/:tenantId/events/:eventId/redemptions/:requestId/approve',
  deny: 'POST /tenants/:tenantId/events/:eventId/redemptions/:requestId/deny',
} as const;
