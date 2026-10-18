/**
 * C-I — CSV import jobs + guest invitations (not platform membership invites).
 */

import type { CursorPage, FieldValidationError } from './common';

export type ImportKind = 'CODES' | 'GUESTS';

export type ImportJobStatus =
  'CREATED' | 'PREVIEW_READY' | 'COMMITTING' | 'COMPLETED' | 'FAILED';

export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  encoding: 'utf-8',
} as const;

/** Technical default; production retention/TTL policy is O06 (unset). */
export const IMPORT_ERROR_REPORT_TTL_HOURS_DEV = 24;

export interface ImportCreateBody {
  kind: ImportKind;
  /** Explicit mapping — required for commit. */
  sourceId: string;
  ticketTypeId: string;
  /** Server-side file ref after quarantine upload, or omit when using legacy rawCodes. */
  fileId?: string;
  /** Defaults to 1; server rejects stale revisions. */
  mappingRevision?: number;
  columnMapping?: ImportColumnMapping;
  /**
   * Legacy compatibility path (≤500 codes). Not a full CSV job.
   * Prefer fileId + preview/commit for CSV.
   */
  rawCodes?: string[];
}

/** Header names selected by the user; logical fields depend on kind. */
export interface ImportColumnMapping {
  code?: string;
  email?: string;
}
export interface ImportFileUploadResponse {
  fileId: string;
  /** SHA-256 hex of accepted bytes; never a storage object key. */
  fileHash: string;
  byteLength: number;
}
export interface ImportPreviewBody {
  /** Omitted values use stored mapping/default code or email header. */
  mappingRevision?: number;
  columnMapping?: ImportColumnMapping;
}
export interface ImportErrorReportMeta {
  importId: string;
  expiresAt: string;
  rowCount: number;
}

export interface ImportJob {
  importId: string;
  kind: ImportKind;
  status: ImportJobStatus;
  sourceId: string;
  ticketTypeId: string;
  fileHash: string | null;
  mappingRevision: number | null;
  previewRevision: number | null;
  validRowCount: number | null;
  errorRowCount: number | null;
  invitationCount: number | null;
  /** Quota estimate only — never reserved by preview. */
  estimatedQuota: number | null;
  replayed?: boolean;
}

export interface ImportPreviewResponse {
  importId: string;
  previewRevision: number;
  mappingRevision: number;
  fileHash: string;
  validRowCount: number;
  errorRowCount: number;
  invitationCount: number;
  estimatedQuota: number;
  sampleErrors: FieldValidationError[];
}

export interface ImportCommitBody {
  previewRevision: number;
  mappingRevision: number;
  fileHash: string;
}

export interface ImportCommitResponse {
  importId: string;
  status: 'COMPLETED';
  committedRowCount: number;
  skippedRowCount: number;
  errorRowCount: number;
  invitationCount: number;
  replayed: boolean;
}

export type InvitationState =
  'PENDING' | 'DISPATCHED' | 'CLAIMED' | 'EXPIRED' | 'REVOKED';

/** Technical default invitation TTL (may shorten to redemption close). */
export const INVITATION_TTL_HOURS_DEFAULT = 48;

export interface InvitationSummary {
  invitationId: string;
  eventId: string;
  sourceId: string;
  ticketTypeId: string;
  /** Masked email only in list projections. */
  invitedEmailMasked: string;
  state: InvitationState;
  expiresAt: string;
}

export interface InvitationDispatchPreviewBody {
  invitationIds: string[];
}

export interface InvitationDispatchPreviewResponse {
  previewRevision: number;
  selectedCount: number;
  /** Quota estimate — not reserved. */
  estimatedQuota: number;
}

export interface InvitationDispatchBody {
  invitationIds: string[];
  previewRevision: number;
}

export interface InvitationDispatchResponse {
  dispatchedCount: number;
  previewRevision: number;
  replayed: boolean;
}

export interface InvitationClaimBody {
  token: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, string | boolean>;
  termsAccepted?: true;
}

export const IMPORT_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  IMPORT_NOT_FOUND: 'IMPORT_NOT_FOUND',
  IMPORT_STALE_PREVIEW: 'IMPORT_STALE_PREVIEW',
  IMPORT_FILE_INVALID: 'IMPORT_FILE_INVALID',
  IMPORT_ROW_LIMIT: 'IMPORT_ROW_LIMIT',
  IMPORT_SOURCE_INVALID: 'IMPORT_SOURCE_INVALID',
  IMPORT_TYPE_INVALID: 'IMPORT_TYPE_INVALID',
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_EMAIL_MISMATCH: 'INVITATION_EMAIL_MISMATCH',
  INVITATION_TOKEN_INVALID: 'INVITATION_TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type ImportErrorCode =
  (typeof IMPORT_ERROR_CODES)[keyof typeof IMPORT_ERROR_CODES];

export const IMPORT_ENDPOINTS = {
  upload: 'POST /tenants/:tenantId/events/:eventId/imports/files',
  create: 'POST /tenants/:tenantId/events/:eventId/imports',
  get: 'GET /tenants/:tenantId/events/:eventId/imports/:importId',
  preview: 'POST /tenants/:tenantId/events/:eventId/imports/:importId/preview',
  commit: 'POST /tenants/:tenantId/events/:eventId/imports/:importId/commit',
  errors: 'GET /tenants/:tenantId/events/:eventId/imports/:importId/errors',
  listInvitations: 'GET /tenants/:tenantId/events/:eventId/invitations',
  dispatchPreview:
    'POST /tenants/:tenantId/events/:eventId/invitations/dispatch-preview',
  dispatch: 'POST /tenants/:tenantId/events/:eventId/invitations/dispatch',
  claim: 'POST /tenants/:tenantId/events/:eventId/invitations/claim',
} as const;

export type InvitationListPage = CursorPage<InvitationSummary>;
