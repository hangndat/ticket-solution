/** Public transport contracts only. Do not import database models here. */
export const API_VERSION = 'v1' as const;
export interface HealthResponse {
  status: 'ok';
  service: 'api';
  version: string;
}
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  operationId?: string;
  retryable: boolean;
}

/** Authenticated caller identity after OIDC JWT verification (Keycloak). */
export interface MeResponse {
  userId: string;
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

/** Stable API error codes for identity (D1). */
export const IDENTITY_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  OIDC_MISCONFIGURED: 'OIDC_MISCONFIGURED',
} as const;

/**
 * Stable API error codes for redemption / issue (D2 + C-F extensions).
 * Additive only — existing codes keep meaning.
 */
export const ISSUE_ERROR_CODES = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  CODE_INVALID: 'CODE_INVALID',
  CODE_CONSUMED: 'CODE_CONSUMED',
  CODE_DISABLED: 'CODE_DISABLED',
  EVENT_CLOSED: 'EVENT_CLOSED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_ARCHIVED: 'EVENT_ARCHIVED',
  REDEMPTION_WINDOW_CLOSED: 'REDEMPTION_WINDOW_CLOSED',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  ATTENDEE_LIMIT: 'ATTENDEE_LIMIT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  RETRYABLE_CONFLICT: 'RETRYABLE_CONFLICT',
  CODE_HMAC_MISCONFIGURED: 'CODE_HMAC_MISCONFIGURED',
  FORM_REQUIRED: 'FORM_REQUIRED',
  FORM_INVALID: 'FORM_INVALID',
  FORM_VERSION_STALE: 'FORM_VERSION_STALE',
  TERMS_REQUIRED: 'TERMS_REQUIRED',
  TERMS_VERSION_STALE: 'TERMS_VERSION_STALE',
  PENDING_EXPIRED: 'PENDING_EXPIRED',
  PENDING_LIMIT: 'PENDING_LIMIT',
  REDEMPTION_NOT_FOUND: 'REDEMPTION_NOT_FOUND',
} as const;

export type IssueErrorCode =
  (typeof ISSUE_ERROR_CODES)[keyof typeof ISSUE_ERROR_CODES];

/**
 * Redeem body (D2 + additive C-F fields).
 * Older clients may omit answers/termsAccepted; server enforces when required.
 */
export interface RedeemRequestBody {
  code: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, string | boolean>;
  termsAccepted?: true;
}

export interface RedeemResponse {
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

export interface TicketSummary {
  ticketId: string;
  tenantId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: string;
  credentialVersion: number;
  createdAt: string;
}

export interface MeTicketsResponse {
  tickets: TicketSummary[];
}

export interface OperationStatusResponse {
  operationId: string;
  status: string;
  /** Receipt snapshot — use owner status API for live PENDING→ISSUED. */
  response:
    | RedeemResponse
    | import('./redemption-forms').RedeemPendingResponse
    | ApiError
    | null;
}

/**
 * Lightweight public catalog projection (existing).
 * Typed published content sections live in EventConfigPayload — do not fork.
 */
export interface PublicEvent {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  startsAt: string;
  timezone: string;
  location: string;
  brand: { primaryColor: string; organizationName: string };
}

/* —— Feature freeze modules (C-E / C-B / C-I / C-F / C-N) —— */

export {
  CURSOR_PAGE_LIMIT,
  IDEMPOTENCY_HEADER,
  type CursorPage,
  type FieldValidationError,
  type ApiErrorWithFields,
} from './common';

export {
  REDEMPTION_COMMAND,
  REDEEM_COMMAND,
  REDEMPTION_APPROVE_COMMAND,
  REDEMPTION_DENY_COMMAND,
  EVENT_CREATE_COMMAND,
  EVENT_UPDATE_COMMAND,
  EVENT_CLONE_COMMAND,
  EVENT_ARCHIVE_COMMAND,
  EVENT_CANCEL_COMMAND,
  CONFIG_SAVE_COMMAND,
  CONFIG_PUBLISH_COMMAND,
  CONFIG_ROLLBACK_COMMAND,
  IMPORT_CREATE_COMMAND,
  IMPORT_PREVIEW_COMMAND,
  IMPORT_COMMIT_COMMAND,
  INVITATION_DISPATCH_COMMAND,
  INVITATION_CLAIM_COMMAND,
  NOTIFICATION_TEMPLATE_PUBLISH_COMMAND,
  NOTIFICATION_REMINDER_CREATE_COMMAND,
  NOTIFICATION_REMINDER_CANCEL_COMMAND,
  NOTIFICATION_RETRY_COMMAND,
  type OperationCommand,
} from './commands';

export {
  EVENT_ERROR_CODES,
  EVENT_ENDPOINTS,
  type EventContentStatus,
  type EventBusinessStatus,
  type EventVisibility,
  type EventWindow,
  type EventVenue,
  type EventContact,
  type EventDetail,
  type CreateEventBodyV2,
  type PatchEventBody,
  type CloneEventBody,
  type CancelEventBody,
  type ArchiveEventBody,
  type EventImpactPreviewRequest,
  type EventImpactPreviewResponse,
  type EventListPage,
  type EventErrorCode,
} from './events';

export {
  EVENT_CONTENT_SECTION_KINDS,
  ASSET_LIMITS,
  CONFIG_FEATURE_ERROR_CODES,
  CONFIG_ENDPOINTS,
  type EventContentSectionKind,
  type AssetMime,
  type AssetStatus,
  type EventBrandSnapshot,
  type EventContentSection,
  type EventConfigPayload,
  type ConfigVersionSummary,
  type ConfigVersionListPage,
  type ConfigPreviewResponse,
  type ConfigRollbackBody,
  type ConfigRollbackResponse,
  type AssetUploadInitBody,
  type AssetUploadInitResponse,
  type AssetFinalizeBody,
  type AssetFinalizeResponse,
  type ConfigFeatureErrorCode,
} from './config';

export {
  IMPORT_LIMITS,
  IMPORT_ERROR_REPORT_TTL_HOURS_DEV,
  INVITATION_TTL_HOURS_DEFAULT,
  IMPORT_ERROR_CODES,
  IMPORT_ENDPOINTS,
  type ImportKind,
  type ImportJobStatus,
  type ImportCreateBody,
  type ImportJob,
  type ImportPreviewResponse,
  type ImportCommitBody,
  type ImportCommitResponse,
  type InvitationState,
  type InvitationSummary,
  type InvitationDispatchPreviewBody,
  type InvitationDispatchPreviewResponse,
  type InvitationDispatchBody,
  type InvitationDispatchResponse,
  type InvitationClaimBody,
  type ImportErrorCode,
  type InvitationListPage,
} from './import-invite';

export {
  FORM_LIMITS,
  PENDING_REVIEW_TTL_HOURS_DEFAULT,
  MAX_PENDING_PER_USER_EVENT_DEFAULT,
  FORM_ERROR_CODES,
  APPROVAL_PENDING,
  REDEMPTION_ENDPOINTS,
  type FormFieldType,
  type FormSelectOption,
  type FormFieldDefinition,
  type FormDefinition,
  type FormAnswerValue,
  type RedeemRequestBodyV2,
  type RedeemPendingResponse,
  type RedeemIssuedResult,
  type RedeemMutationResult,
  type OwnerRedemptionStatus,
  type StaffPendingRedemptionItem,
  type StaffPendingRedemptionPage,
  type FormValidationErrorBody,
  type FormErrorCode,
} from './redemption-forms';

export {
  NOTIFICATION_KINDS,
  NOTIFICATION_PAYLOAD_VERSIONS,
  NOTIFICATION_RETRY_DEFAULTS,
  NOTIFICATION_RATE_DEFAULTS,
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_ENDPOINTS,
  type NotificationKind,
  type NotificationProviderStatus,
  type NotificationChannel,
  type NotificationAttempt,
  type NotificationSummary,
  type NotificationListPage,
  type NotificationTemplateVariable,
  type NotificationTemplateVersion,
  type NotificationTemplatePreviewBody,
  type NotificationTemplatePreviewResponse,
  type ReminderCreateBody,
  type ReminderPreviewBody,
  type ReminderPreviewResponse,
  type ReminderSummary,
  type NotificationRetryBody,
  type NotificationErrorCode,
} from './notifications';
