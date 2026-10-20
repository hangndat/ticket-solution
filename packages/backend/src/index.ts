import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';
import { withTenant } from './tenant-context';

export { PrismaClient, Prisma };
export { withTenant, withActor } from './tenant-context';
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
  BrandingError,
  BRANDING_ERROR_CODES,
  type BrandingErrorCode,
} from './branding-error';
export {
  getTenantBranding,
  updateTenantBranding,
  parseBrandingUpdatePatch,
  type TenantBrandingRecord,
  type UpdateTenantBrandingInput,
  type BrandingUpdatePatch,
} from './branding';
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
  readSupportedPepperConfigs,
  readRoutingFingerprintSecret,
  readResolveTokenSecret,
  isSingleCodeResolveGlobalEnabled,
} from './code-routing-config';
export {
  attachCodeRoutingOnInsert,
  lookupRoutableTarget,
  buildRedemptionResolveResponse,
  backfillCodeRoutingFromRedemptionCodes,
  countAmbiguousRoutingGroups,
  verifyResolveTokenForIssue,
  normalizeRedemptionCodeInput,
  routingFingerprint,
  routingKeyFromFingerprint,
  digestAliasesForCode,
  type RoutableTarget,
} from './code-routing';
export {
  signResolveToken,
  verifyResolveToken,
  type ResolveTokenClaims,
} from './resolve-token';
export {
  REDEEM_COMMAND,
  APPROVAL_PENDING,
  redeemAndIssueTicket,
  listTicketsForOwner,
  listAllTicketsForOwner,
  listOwnerTicketsAggregated,
  getTicketForOwner,
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
  type ListedTicketWithTenant,
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
  ImportError,
  IMPORT_ERROR_CODES,
  importErrorHttpStatus,
  type ImportErrorCode,
} from './import-error';
export {
  uploadImportFile,
  createImportJob,
  getImportJob,
  previewImportJob,
  commitImportJob,
  downloadImportErrors,
  cleanupExpiredImportFiles,
} from './import-jobs';
export {
  listGuestInvitations,
  previewInvitationDispatch,
  dispatchGuestInvitations,
  claimGuestInvitation,
} from './guest-invitations';
export {
  D9_DEMO,
  D9_LEGACY_TENANT_SLUGS,
  seedD9DemoDataset,
  type D9DemoSeedOptions,
  type D9DemoSeedReport,
} from './demo-seed';
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
  readMinioImportsEnvironment,
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
  listTicketTypes,
  listIssuanceSources,
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
  recordGateReject,
  unwrapReserveOutcome,
  unwrapConfirmOutcome,
  type StaffSessionResult,
  type ReserveResult,
  type ConfirmResult,
  type ReserveOutcome,
  type ConfirmOutcome,
  type GateDenyOutcome,
  type UndoResult,
} from './gate';
export {
  sortOfflineEventsForReplay,
  validateOfflineSyncRequest,
  offlineSyncNotImplemented,
  applyOfflineSyncBatch,
  offlineEventPayloadHash,
  compareOfflineReplayOrder,
  isWithinOfflineClockSkew,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_ERROR_CODES,
  type ApplyOfflineSyncInput,
} from './offline-sync';
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
  listPublishedEvents,
  listPlatformPublishedEvents,
  getPublishedEventDetail,
  isValidPublicTenantSlug,
  isValidPublicEventSlug,
  PublishedEventsError,
  PUBLISHED_EVENTS_ERROR_CODES,
} from './published-events';
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
  readPortfolioReport,
  GATE_REJECT_AUDIT_ACTION,
  PORTFOLIO_PAGE_LIMIT,
  type EventReport,
  type PortfolioReport,
  type PortfolioReportItem,
  type TicketStateCounts,
  type QuotaCapacityState,
} from './reporting';
export {
  listEventAudit,
  listEventAuditForTenant,
  listEventCodes,
  listEventCodesForTenant,
  listPlatformAudit,
} from './portal-audit-codes';
export {
  createNoopEmailAdapter,
  createFailingEmailAdapter,
  createMisconfiguredEmailAdapter,
  createSmtpEmailAdapter,
  readEmailEnvironment,
  readPublicWebBaseUrl,
  type EmailAdapter,
  type TicketIssuedEmailPayload,
  type MembershipInviteEmailPayload,
  type GuestInvitationEmailPayload,
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
  listExportJobs,
  downloadExport,
  processExportJob,
  relayExportsOnce,
  parseTtlSeconds,
  type ExportFilter,
  type ExportJob,
  type ExportJobSummary,
  type ExportJobsPage,
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
  isApnsEnabled,
  readApnsPrivateKeyPem,
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
  DEFAULT_PRODUCT_WEB_ORIGIN,
  resolveProductWebBaseUrl,
  buildInviteAcceptLink,
  buildGuestInvitationClaimLink,
} from './web-links';
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

export {
  PlatformError,
  PLATFORM_ERROR_CODES,
  type PlatformErrorCode,
} from './platform-error';
export {
  readPlatformSecurityConfig,
  type PlatformSecurityConfig,
} from './platform-config';
export {
  createPlatformOidcVerifier,
  type PlatformOidcVerifier,
  type PlatformVerifiedIdentity,
} from './platform-oidc';
export {
  tenantPermissionsForRole,
  eventPermissionsForRole,
  isMembershipRole,
  isPresetId,
  isMembershipRoleOrPresetId,
  parseInviteRole,
  inviteRoleStorageKey,
  assertCatalogPermissions,
  isCatalogPermission,
  PERMISSION_CATALOG,
  ROLE_SCHEMA_VERSION,
  type InviteRoleRef,
} from './role-map';
export {
  createRolePreset,
  listRolePresets,
  getRolePreset,
  loadPresetInTenant,
  type RolePresetRecord,
} from './role-presets';
export {
  bootstrapPlatformOperator,
  requireActivePlatformOperator,
  getPlatformMe,
  withPlatformOperator,
} from './platform-operator';
export {
  provisionTenant,
  setTenantStatus,
  updateTenantLimits,
  getPlatformTenantDetail,
  getPlatformTenantHealth,
  listPlatformTenants,
  type ProvisionResult,
} from './platform-tenant';
export {
  registerPendingTenant,
  readSelfServeRegistrationConfig,
  SELF_SERVE_DEFAULT_LIMITS,
  SELF_SERVE_DEFAULT_FLAGS,
  type SelfServeRegistrationConfig,
} from './tenant-registration';
export {
  listMyTenants,
  listMyEvents,
  createMembershipInvite,
  acceptMembershipInvite,
  revokeMembershipKeepingLastOwner,
} from './membership-invite';
export {
  listPortalMembers,
  listPortalInvites,
  changePortalMemberRole,
  putPortalEventAssignment,
  deletePortalEventAssignment,
  revokePortalInvite,
  resendPortalInvite,
} from './portal-members';
export {
  createSupportGrant,
  revokeSupportGrant,
  listSupportTickets,
} from './support-grant';
export {
  createAccountDeletionRequest,
  getCurrentAccountDeletionRequest,
  listDueAccountAnonymizations,
  applyAccountAnonymization,
  processDueAccountAnonymizations,
  purgeExpiredAccountDeletionTombstones,
  assertIdentityAllowedForUpsert,
  type AccountDeletionAck,
  type DueAccountAnonymization,
  type ApplyAccountAnonymizationResult,
  type ProcessDueAccountDeletionOptions,
  type ProcessDueAccountDeletionResult,
} from './account-deletion';
export {
  readTombstoneKeyring,
  mintTombstoneDigest,
  digestsForIdentity,
  TombstoneKeyringError,
  type TombstoneKeyring,
} from './tombstone-keyring';
export {
  createKeycloakErasureAdapter,
  createFakeKeycloakErasureAdapter,
  readKeycloakErasureEnvironment,
  isUuidSubject,
  IDP_ERROR_CODES,
  type KeycloakErasureAdapter,
  type ErasureOutcome,
  type KeycloakErasureConfig,
} from './keycloak-erasure';
export {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
  assertAccessTokenBounds,
} from './access-token-bounds';
export {
  O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
  O06_ACCOUNT_ANONYMIZE_POLICY_VERSION,
  O06_TICKET_PII_RETENTION_DAYS,
  O06_OBJECT_RETENTION_DAYS,
  O06_AUDIT_TTL_DAYS,
  processDueTicketPiiAnonymizations,
  processDueObjectRetentions,
} from './retention-o06';
export {
  lockTenantPolicyForShare,
  lockTenantPolicyForUpdate,
  assertTenantAllowsIssue,
  assertTenantAllowsAdminMutation,
  type TenantPolicyRow,
} from './tenant-policy';

export { withPlatformRole } from './platform-context';
