/** Public transport contracts only. Do not import database models here. */
export * from './portal-admin';
import type { NotificationProviderStatus } from './notifications';

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
  /** JWKS / IdP temporarily unreachable — clients should retry. */
  OIDC_UNAVAILABLE: 'OIDC_UNAVAILABLE',
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
  /** Owner ticket read — missing or not owned (fail-closed 404). */
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  RESOLVE_TOKEN_REQUIRED: 'RESOLVE_TOKEN_REQUIRED',
  RESOLVE_TOKEN_STALE: 'RESOLVE_TOKEN_STALE',
  RESOLVE_DISABLED: 'RESOLVE_DISABLED',
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
  /** Present when the event row still exists; omitted if deleted. */
  eventName?: string;
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
 * Lightweight public catalog projection (legacy fixture shape).
 * Prefer PublishedEventSummary / PublishedEventDetail (ADR-19) for Nest public APIs.
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

export {
  PUBLISHED_SECTION_KINDS,
  PUBLISHED_EVENT_ENDPOINTS,
  PLATFORM_PUBLISHED_EVENT_LIST_ORDER,
  PLATFORM_PUBLISHED_EVENTS_OPENAPI_PATH,
  PLATFORM_PUBLISHED_EVENTS_OPERATION_ID,
  type PublishedSectionKind,
  type PublishedSection,
  type PublishedFaqItem,
  type PublishedTerms,
  type PublishedBrand,
  type PublishedEventDetail,
  type PublishedEventSummary,
  type PublishedEventListResponse,
  type PublishedEventListPage,
  type PublishedEventListQuery,
} from './published-events';

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
  OFFLINE_SYNC_COMMAND,
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
  REDEMPTION_RESOLVE_HEADER,
  REDEMPTION_FLOW,
  RESOLVE_ERROR_CODES,
  REDEMPTION_RESOLVE_ENDPOINT,
  type RedemptionFlow,
  type ResolveErrorCode,
  type RedemptionResolveRequestBody,
  type RedemptionResolvePublished,
  type RedemptionResolveResponse,
} from './redemption-resolve';

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

export {
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_PAYLOAD_VERSION,
  OFFLINE_SYNC_ENDPOINTS,
  OFFLINE_SYNC_EVENT_TYPES,
  OFFLINE_SYNC_ERROR_CODES,
  compareOfflineReplayOrder,
  offlineClockSkewSeconds,
  isWithinOfflineClockSkew,
  type OfflineSyncEventType,
  type OfflineSyncErrorCode,
  type OfflineSyncEvent,
  type OfflineSyncRequestBody,
  type OfflineSyncItemStatus,
  type OfflineSyncItemResult,
  type OfflineSyncResponse,
  type OfflineSyncBatchError,
} from './offline-sync';

/* —— CS / export / event-admin / device-token (PR54) —— */
/* NotificationProviderStatus: from C-N (PR54 values + UNKNOWN). */

export const CS_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  QUERY_TOO_LONG: 'QUERY_TOO_LONG',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  RESEND_LIMIT: 'RESEND_LIMIT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type CsErrorCode = (typeof CS_ERROR_CODES)[keyof typeof CS_ERROR_CODES];

export interface CsNotificationSummary {
  channel: string;
  state: string;
  providerStatus: NotificationProviderStatus;
  providerRef: string | null;
  attempts: number;
  /** Always null in API responses — never expose raw provider errors. */
  lastError: null;
}

export interface CsTicketSummary {
  ticketId: string;
  state: string;
  ticketTypeId: string;
  sourceId: string;
  createdAt: string;
  ownerEmailMasked: string | null;
  lastCheckInAt: string | null;
  notification: CsNotificationSummary | null;
}

export interface CsTimelineItem {
  at: string;
  kind: string;
  summary: string;
}

export interface CsTicketDetail extends CsTicketSummary {
  timeline: CsTimelineItem[];
}

export interface CsTicketListResponse {
  items: CsTicketSummary[];
  nextCursor: string | null;
}

export interface CsResendResponse {
  operationId: string;
  notificationId: string;
  providerStatus: 'PENDING';
  replayed: boolean;
}

export const EXPORT_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EXPORT_NOT_FOUND: 'EXPORT_NOT_FOUND',
  EXPORT_NOT_READY: 'EXPORT_NOT_READY',
  EXPORT_EXPIRED: 'EXPORT_EXPIRED',
  MINIO_MISCONFIGURED: 'MINIO_MISCONFIGURED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_FILTER: 'INVALID_FILTER',
} as const;

export type ExportErrorCode =
  (typeof EXPORT_ERROR_CODES)[keyof typeof EXPORT_ERROR_CODES];

export interface ExportCreateBody {
  format: 'csv';
  filter?: {
    states?: string[];
    from?: string;
    to?: string;
  };
}

export interface ExportJob {
  exportId: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  rowCount: number | null;
  expiresAt: string | null;
  error: string | null;
  replayed?: boolean;
}

export const EVENT_ADMIN_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  INVALID_WINDOW: 'INVALID_WINDOW',
  TICKET_TYPE_NOT_FOUND: 'TICKET_TYPE_NOT_FOUND',
  INVALID_APPROVAL_MODE: 'INVALID_APPROVAL_MODE',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type EventAdminErrorCode =
  (typeof EVENT_ADMIN_ERROR_CODES)[keyof typeof EVENT_ADMIN_ERROR_CODES];

export interface CreateEventBody {
  slug: string;
  name: string;
  timezone?: string;
  redemptionOpensAt?: string;
  redemptionClosesAt?: string;
}

export interface EventSummary {
  eventId: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
}

export interface EventListResponse {
  items: EventSummary[];
}

export interface CreateTicketTypeBody {
  label: string;
  entitlementSnapshot?: Record<string, unknown>;
}

export interface TicketTypeCreated {
  ticketTypeId: string;
  label: string;
}

export interface CreateSourceBody {
  name: string;
  approvalMode: 'AUTO' | 'MANUAL';
  ticketTypeId: string;
}

export interface SourceCreated {
  sourceId: string;
  name: string;
  approvalMode: 'AUTO' | 'MANUAL';
  ticketTypeId: string;
}

export const DEVICE_TOKEN_ERROR_CODES = {
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  INVALID_ENVIRONMENT: 'INVALID_ENVIRONMENT',
  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',
  APNS_MISCONFIGURED: 'APNS_MISCONFIGURED',
} as const;

export type DeviceTokenErrorCode =
  (typeof DEVICE_TOKEN_ERROR_CODES)[keyof typeof DEVICE_TOKEN_ERROR_CODES];

export interface DeviceTokenRegisterBody {
  token: string;
  environment: 'sandbox' | 'production';
}

export interface DeviceTokenRegistration {
  registrationId: string;
  environment: 'sandbox' | 'production';
  /** ISO timestamp when the registration became active. */
  registeredAt: string;
}

/** Platform / tenant-admin error codes (M01/M02/M12). */
export const PLATFORM_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  PLATFORM_OPERATOR_REQUIRED: 'PLATFORM_OPERATOR_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  MEMBERSHIP_REVOKED: 'MEMBERSHIP_REVOKED',
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  STALE_VERSION: 'STALE_VERSION',
  LAST_OWNER_REQUIRED: 'LAST_OWNER_REQUIRED',
  LIMIT_BELOW_USAGE: 'LIMIT_BELOW_USAGE',
  TENANT_LIMIT_REACHED: 'TENANT_LIMIT_REACHED',
  INVITE_ALREADY_USED: 'INVITE_ALREADY_USED',
  INVITE_INVALID_OR_EXPIRED: 'INVITE_INVALID_OR_EXPIRED',
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_PENDING: 'TENANT_PENDING',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  PLATFORM_MISCONFIGURED: 'PLATFORM_MISCONFIGURED',
  BOOTSTRAP_ALREADY_DONE: 'BOOTSTRAP_ALREADY_DONE',
} as const;

export type PlatformErrorCode =
  (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];

export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type MembershipRole =
  'Owner' | 'Manager' | 'CS' | 'Supervisor' | 'Scanner';

export type SupportScope = 'cs.read';

export type AccountDeletionState =
  'REQUESTED' | 'UNDER_REVIEW' | 'AWAITING_POLICY' | 'COMPLETED' | 'REJECTED';

export interface TenantLimitsDto {
  maxEvents: number | null;
  maxStaff: number | null;
  emailPerDay: number | null;
  importRowsPerJob: number | null;
}

export interface TenantFlagsDto {
  importsEnabled: boolean;
  exportsEnabled: boolean;
}

/** Role on me/tenants — membership roles plus synthetic Attendee (ticket owner, no membership). */
export type MeTenantRole = MembershipRole | 'Attendee';

export interface MeTenantItem {
  tenantId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  tenantPermissions: string[];
  role: MeTenantRole;
}

export interface MeTenantsResponse {
  items: MeTenantItem[];
}

export interface MeEventItem {
  tenantId: string;
  eventId: string;
  name: string;
  permissions: string[];
}

export interface MeEventsResponse {
  /** true iff active tenant membership OR active event assignment */
  staffEligible: boolean;
  items: MeEventItem[];
}

export interface PlatformMeResponse {
  operator: boolean;
  permittedCommands: string[];
  assurance: 'mfa' | 'missing';
}

export interface PlatformCreateTenantBody {
  slug: string;
  name: string;
  defaultTimezone: string;
  contact?: string | null;
  ownerEmail: string;
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
}

export interface PlatformCreateTenantResponse {
  tenantId: string;
  status: 'PENDING';
  version: number;
  ownerInviteId: string;
}

/** P2-ONBOARD-PENDING — authenticated self-serve signup (no secrets in response). */
export interface PublicTenantRegistrationBody {
  slug: string;
  name: string;
  defaultTimezone?: string;
  contact?: string | null;
}

export interface PublicTenantRegistrationResponse {
  registrationId: string;
  tenantId: string;
  status: 'PENDING';
}

export interface PlatformTenantDetail {
  tenantId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  defaultTimezone: string;
  contact: string | null;
  version: number;
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
  usage: {
    events: number;
    staffActive: number;
    staffPendingInvites: number;
    emailToday: number;
  };
}

export interface PlatformTenantStatusBody {
  status: 'ACTIVE' | 'SUSPENDED';
  reason: string;
  expectedVersion: number;
}

export interface PlatformTenantLimitsBody {
  limits: TenantLimitsDto;
  flags: TenantFlagsDto;
  reason: string;
  expectedVersion: number;
}

export interface TenantProfilePatchBody {
  name?: string;
  contact?: string | null;
  defaultTimezone?: string;
  logoAssetId?: string | null;
  expectedVersion: number;
}

/** D8-S1 — Tenant white-label branding (resolved defaults applied by API). */
export interface TenantBranding {
  tenantId: string;
  slug: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  logoAssetId: string | null;
  version: number;
}

export interface TenantBrandingUpdateBody {
  displayName?: string;
  primaryColor?: string;
  secondaryColor?: string | null;
  logoAssetId?: string | null;
  expectedVersion: number;
}

/** Public chrome — GET /v1/public/tenants/{slug}/branding */
export interface PublicTenantBranding {
  tenantSlug: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  logoAssetId: string | null;
  logoUrl?: string;
}

/** Built-in enum or named server preset (P2-ROLES-PRESET / ADR §7.3). */
export type InviteRoleRef = MembershipRole | { presetId: string };

export interface CreateInviteBody {
  email: string;
  role: InviteRoleRef;
  eventAssignments?: Array<{ eventId: string; role: MembershipRole }>;
  /** Forbidden — server rejects if present (ADR §7). */
  permissions?: never;
  tenantPermissions?: never;
  eventPermissions?: never;
}

export interface RolePresetDto {
  presetId: string;
  tenantId: string | null;
  name: string;
  schemaVersion: number;
  tenantPermissions: string[];
  eventPermissions: string[];
  createdAt: string;
}

export interface CreateRolePresetBody {
  name: string;
  tenantPermissions?: string[];
  eventPermissions?: string[];
}

export interface RolePresetsListResponse {
  items: RolePresetDto[];
}

export interface InviteCreatedResponse {
  inviteId: string;
  state: 'PENDING';
  expiresAt: string;
  deliveryState: 'PENDING' | 'FAILED';
}

export interface AcceptInviteBody {
  token: string;
}

export interface AcceptInviteResponse {
  tenantId: string;
  membershipId: string;
  status: TenantStatus;
}

export interface CreateSupportGrantBody {
  tenantId: string;
  eventId: string;
  scopes: SupportScope[];
  reason: string;
  expiresAt: string;
}

export interface SupportGrantResponse {
  grantId: string;
  tenantId: string;
  eventId: string;
  scopes: SupportScope[];
  expiresAt: string;
}

export interface AccountDeletionRequestBody {
  confirmation: true;
}

export interface AccountDeletionRequestResponse {
  requestId: string;
  state: 'AWAITING_POLICY';
  requestedAt: string;
  policyStatus: 'UNRESOLVED';
}

export type {
  ImportColumnMapping,
  ImportFileUploadResponse,
  ImportPreviewBody,
  ImportErrorReportMeta,
} from './import-invite';
