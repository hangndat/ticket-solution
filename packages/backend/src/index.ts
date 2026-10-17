import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';
import { withTenant } from './tenant-context';

export { PrismaClient, Prisma };
export { withTenant };
export {
  IdentityError,
  IDENTITY_ERROR_CODES,
  type IdentityErrorCode,
} from './identity-error';
export {
  readOidcEnvironment,
  createOidcVerifier,
  createLocalJwks,
  type OidcConfig,
  type OidcVerifier,
  type VerifiedIdentity,
  type CreateOidcVerifierOptions,
} from './oidc';
export {
  createPrismaIdentityUserRepository,
  type IdentityUserRepository,
  type StoredUser,
} from './users';
export {
  AuthzError,
  AUTHZ_ERROR_CODES,
  type AuthzErrorCode,
} from './authz-error';
export {
  isMembershipActive,
  lockActiveMembershipForShare,
  requireTenantPermission,
  grantMembership,
  grantEventAssignment,
  revokeMembership,
  revokeEventAssignment,
  type MembershipRecord,
  type EventAssignmentRecord,
  type RequireTenantPermissionInput,
  type GrantMembershipInput,
  type GrantEventAssignmentInput,
} from './membership';
export {
  IssueError,
  ISSUE_ERROR_CODES,
  type IssueErrorCode,
} from './issue-error';
export {
  readCodeHmacEnvironment,
  hashRedemptionCode,
  codesEqualHmac,
  type CodeHmacConfig,
} from './code-hmac';
export {
  REDEEM_COMMAND,
  APPROVAL_PENDING,
  redeemAndIssueTicket,
  listTicketsForOwner,
  getOperationForActor,
  storedRejectionFromResponse,
  throwIfStoredRejection,
  unwrapRedeemOutcome,
  type RedeemInput,
  type IssuedTicketResult,
  type TerminalRejection,
  type RedeemOutcome,
  type PendingApprovalResult,
  type ListedTicket,
} from './issue';
export {
  InventoryError,
  INVENTORY_ERROR_CODES,
  type InventoryErrorCode,
} from './inventory-error';
export {
  seedEventInventory,
  importRedemptionCodes,
  readEventQuota,
  type SeedInventoryInput,
  type SeedInventoryResult,
  type ImportCodesResult,
  type EventQuotaResult,
} from './inventory';
export {
  claimOutboxBatch,
  processClaimedOutbox,
  relayOutboxOnce,
  type ClaimedOutboxRow,
  type ProcessOutboxResult,
  type ProcessOutboxOptions,
} from './outbox';
export {
  ConfigError,
  CONFIG_ERROR_CODES,
  type ConfigErrorCode,
} from './config-error';
export {
  saveEventConfigVersion,
  publishEventConfig,
  listEventConfigVersions,
  previewEventConfigVersion,
  rollbackEventConfig,
  type ConfigVersionResult,
  type PublishResult,
} from './config-publish';
export {
  parseConfigPayload,
  requireValidConfigPayload,
  isSchemaCompatible,
  CONFIG_SCHEMA_VERSION,
  SUPPORTED_CONFIG_SCHEMA_VERSIONS,
  CONFIG_TEXT_LIMITS,
} from './config-schema';
export {
  initEventAssetUpload,
  finalizeEventAssetUpload,
  reencodeRasterAsset,
  assertAssetsReadyForBrand,
  assertAssetInitBody,
} from './config-assets';
export {
  readMinioEnvironment,
  requireMinioConfig,
  createMinioObjectStore,
  createMemoryObjectStore,
  putObject,
  getObject,
  createPresignedPutUrl,
  type MinioConfig,
  type ObjectStore,
} from './minio';
export {
  EventError,
  EVENT_ERROR_CODES,
  type EventErrorCode,
} from './event-error';
export {
  canEnqueueOutboxKind,
  isWindowOpen,
  lockEventPolicyForShare,
  assertOpenForIssuance,
  assertOpenForGate,
  SUPPORTED_OUTBOX_KINDS,
} from './event-policy';
export {
  createEvent,
  getEvent,
  listEvents,
  updateEvent,
  cloneEvent,
  archiveEvent,
  cancelEvent,
  previewEventImpact,
  deterministicEventId,
  createTicketType,
  createIssuanceSource,
  CREATOR_EVENT_PERMISSIONS,
  type EventMutationResult,
  type EventSummary,
} from './event-admin';
export {
  EventAdminError,
  EVENT_ADMIN_ERROR_CODES,
  type EventAdminErrorCode,
} from './event-admin-error';
export { GateError, GATE_ERROR_CODES, type GateErrorCode } from './gate-error';
export {
  openStaffSession,
  revokeStaffSession,
  reserveCheckin,
  confirmCheckin,
  undoCheckin,
  revokeTicket,
  type StaffSessionResult,
  type ReserveResult,
  type ConfirmResult,
  type UndoResult,
} from './gate';
export {
  ApprovalError,
  APPROVAL_ERROR_CODES,
  type ApprovalErrorCode,
} from './approval-error';
export {
  APPROVE_COMMAND,
  DENY_COMMAND,
  holdCodeForReview,
  decideRedemption,
  unwrapApprovalOutcome,
  type ApprovalDecision,
  type HoldPendingInput,
  type DecideRedemptionInput,
  type ApprovalResult,
  type ApprovalRejection,
  type ApprovalOutcome,
} from './approval';
export {
  validateFormAnswers,
  hashFormDefinition,
  hashTermsContent,
  canonicalizeAnswers,
  type FormValidateResult,
} from './form-validate';
export {
  resolveAndValidateConsent,
  buildConsentSnapshot,
  type ConsentSnapshot,
  type RedeemFormInput,
} from './form-consent';
export {
  loadPublishedFormTerms,
  type PublishedFormTerms,
} from './published-form';
export {
  expirePendingRequest,
  expireDuePendingBatch,
  type ExpirePendingResult,
} from './pending-expiry';
export {
  listDuePendingRedemptions,
  reconcileDuePendingRedemptions,
  type DuePendingRow,
} from './pending-expiry-worker';
export {
  getOwnerRedemptionStatus,
  listStaffPendingRedemptions,
} from './redemption-status';
export {
  ReportError,
  REPORT_ERROR_CODES,
  type ReportErrorCode,
} from './report-error';
export {
  readEventReport,
  type EventReport,
  type TicketStateCounts,
} from './reporting';
export {
  createNoopEmailAdapter,
  createFailingEmailAdapter,
  createMisconfiguredEmailAdapter,
  createSmtpEmailAdapter,
  readEmailEnvironment,
  readPublicWebBaseUrl,
  type EmailAdapter,
  type TicketIssuedEmailPayload,
  type EmailSendResult,
  type SmtpAdapterOptions,
} from './email-adapter';
export { CsError, CS_ERROR_CODES, type CsErrorCode } from './cs-error';
export {
  listCsTickets,
  getCsTicket,
  resendTicketEmail,
  type CsTicketSummary,
  type CsTicketDetail,
  type CsTimelineItem,
  type CsNotificationSummary,
} from './cs';
export {
  ExportError,
  EXPORT_ERROR_CODES,
  type ExportErrorCode,
} from './export-error';
export {
  createExportJob,
  getExportJob,
  downloadExport,
  processExportJob,
  relayExportsOnce,
  parseTtlSeconds,
  type ExportFilter,
  type ExportJob,
} from './export';
export { escapeCsvCell, toCsvRow } from './csv-guard';
export {
  DeviceTokenError,
  DEVICE_TOKEN_ERROR_CODES,
  type DeviceTokenErrorCode,
} from './device-token-error';
export {
  registerDeviceToken,
  revokeDeviceToken,
  revokeDeviceTokenByValue,
  listActiveDeviceTokensForUser,
  type DeviceTokenRegistration,
} from './device-tokens';
export {
  readApnsEnvironment,
  requireApnsConfig,
  sendApnsPush,
  createApnsAdapter,
  type ApnsConfig,
  type ApnsAdapter,
  type ApnsSendResult,
} from './apns';
export {
  providerStatusFromDbState,
  maskEmail,
  type ProviderStatus,
} from './notification-status';
export {
  sealCredentialToken,
  openCredentialToken,
  hashCredentialToken,
} from './credential-crypto';
export {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
  type NotificationErrorCode,
} from './notification-error';
export {
  computeBackoffSeconds,
  isWithinJitterBounds,
  readRetryConfig,
  tryConsumeRateLimit,
  assertResendCaps,
  type RetryConfig,
} from './notification-retry';
export {
  TICKET_ISSUED_TEMPLATE_VARS,
  DEFAULT_TICKET_ISSUED_TEMPLATE,
  escapeHtml,
  validateTemplateLiterals,
  renderTemplate,
  renderEscapedPreview,
  previewNotificationTemplate,
  publishNotificationTemplate,
  resolveTicketIssuedTemplate,
  readPublishedGuideContact,
} from './notification-templates';
export {
  buildCredentialQrJson,
  renderCredentialQrPng,
  openCurrentCredentialForQr,
  buildOwnerTicketLink,
} from './qr-ticket';
export {
  listEventNotifications,
  retryNotificationDelivery,
} from './notification-service';
export { sendMimeMailViaSmtp, sendMailViaSmtp } from './smtp-send';

export function createDatabase(
  connectionString: string,
  max = 5,
): PrismaClient {
  validateDatabaseUrl(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

export function validateDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    )
      throw new Error();
    return value;
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with host and database',
    );
  }
}

export function readProcessEnvironment(env: NodeJS.ProcessEnv) {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('Invalid NODE_ENV');
  return { nodeEnv };
}

/** Credential sealing material for ticket QR tokens (local/dev). */
export function readCredentialKeyEnvironment(env: NodeJS.ProcessEnv): string {
  const key = env['TICKET_CREDENTIAL_KEY']?.trim();
  if (!key || key.length < 16) {
    throw new Error('TICKET_CREDENTIAL_KEY must be set (≥16 characters)');
  }
  return key;
}

export {
  metricsInc,
  metricsObserveSeconds,
  metricsSetGauge,
  renderPrometheusText,
  resetMetricsForTests,
  routeTemplateFromPath,
  statusClass,
  startEventLoopLagMonitor,
  getEventLoopLagSeconds,
} from './metrics-registry';
export {
  collectOutboxMetrics,
  collectDbRuntimeMetrics,
  type OutboxMetricSnapshot,
} from './metrics-db';
