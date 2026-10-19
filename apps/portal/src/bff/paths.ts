/** Nest upstream paths for portal prep (ADR-20 / O16). */

const tenantBase = (tenantId: string) =>
  `/v1/tenants/${encodeURIComponent(tenantId)}`;

const eventBase = (tenantId: string, eventId: string) =>
  `${tenantBase(tenantId)}/events/${encodeURIComponent(eventId)}`;

export const PORTAL_UPSTREAM = {
  events: (tenantId: string) => `${tenantBase(tenantId)}/events`,
  event: (tenantId: string, eventId: string) => eventBase(tenantId, eventId),
  clone: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/clone`,
  archive: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/archive`,
  ticketTypes: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/ticket-types`,
  sources: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/sources`,
  quota: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/quota`,
  publish: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/publish`,
  configVersions: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/config-versions`,
  configPreview: (tenantId: string, eventId: string, version: number) =>
    `${eventBase(tenantId, eventId)}/config-versions/${version}/preview`,
  configRollback: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/config/rollback`,
  report: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/report`,
  /** P2 portfolio — O17 / GET …/reports/portfolio (not report-summary) */
  portfolio: (tenantId: string) =>
    `${tenantBase(tenantId)}/reports/portfolio`,
  /** H-A1 event audit browser (report.read + assignment) */
  audit: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/audit`,
  /** H-C1 codes inventory browse (inventory.import; masked, no raw/HMAC) */
  codes: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/codes`,
  /** H-P1 / H-P-AUDIT / H-P2 — platform Operator MFA audience only */
  platformTenants: '/v1/platform/tenants',
  platformAudit: '/v1/platform/audit',
  platformTenantHealth: (tenantId: string) =>
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/health`,
  platformSupportGrantRevoke: (grantId: string) =>
    `/v1/platform/support-grants/${encodeURIComponent(grantId)}/revoke`,
  members: (tenantId: string) => `${tenantBase(tenantId)}/members`,
  revokeMember: (tenantId: string, membershipId: string) =>
    `${tenantBase(tenantId)}/members/${encodeURIComponent(membershipId)}/revoke`,
  memberRole: (tenantId: string, membershipId: string) =>
    `${tenantBase(tenantId)}/members/${encodeURIComponent(membershipId)}/role`,
  /** P2-ROLES-PRESET — named server presets (not permission checkbox composer). */
  rolePresets: (tenantId: string) => `${tenantBase(tenantId)}/role-presets`,
  rolePreset: (tenantId: string, presetId: string) =>
    `${tenantBase(tenantId)}/role-presets/${encodeURIComponent(presetId)}`,
  invites: (tenantId: string) => `${tenantBase(tenantId)}/invites`,
  revokeInvite: (tenantId: string, inviteId: string) =>
    `${tenantBase(tenantId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
  rolePresets: (tenantId: string) => `${tenantBase(tenantId)}/role-presets`,
  branding: (tenantId: string) => `${tenantBase(tenantId)}/branding`,
  /** P2-ONBOARD-PENDING — authenticated self-serve (Bearer + Idempotency-Key) */
  tenantRegistrations: '/v1/public/tenant-registrations',
  /** C-I import job + file quarantine */
  imports: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/imports`,
  importsUpload: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/imports/files`,
  importJob: (tenantId: string, eventId: string, importId: string) =>
    `${eventBase(tenantId, eventId)}/imports/${encodeURIComponent(importId)}`,
  importPreview: (tenantId: string, eventId: string, importId: string) =>
    `${eventBase(tenantId, eventId)}/imports/${encodeURIComponent(importId)}/preview`,
  importCommit: (tenantId: string, eventId: string, importId: string) =>
    `${eventBase(tenantId, eventId)}/imports/${encodeURIComponent(importId)}/commit`,
  importErrors: (tenantId: string, eventId: string, importId: string) =>
    `${eventBase(tenantId, eventId)}/imports/${encodeURIComponent(importId)}/errors`,
  /** Guest invitations (not tenant membership invites) */
  invitations: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/invitations`,
  invitationDispatchPreview: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/invitations/dispatch-preview`,
  invitationDispatch: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/invitations/dispatch`,
  /** G-R2 pending list + approve/deny */
  redemptions: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/redemptions`,
  redemptionApprove: (
    tenantId: string,
    eventId: string,
    requestId: string,
  ) =>
    `${eventBase(tenantId, eventId)}/redemptions/${encodeURIComponent(requestId)}/approve`,
  redemptionDeny: (tenantId: string, eventId: string, requestId: string) =>
    `${eventBase(tenantId, eventId)}/redemptions/${encodeURIComponent(requestId)}/deny`,
  tickets: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/tickets`,
  ticket: (tenantId: string, eventId: string, ticketId: string) =>
    `${eventBase(tenantId, eventId)}/tickets/${encodeURIComponent(ticketId)}`,
  ticketResend: (tenantId: string, eventId: string, ticketId: string) =>
    `${eventBase(tenantId, eventId)}/tickets/${encodeURIComponent(ticketId)}/resend`,
  notifications: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/notifications`,
  notificationRetry: (
    tenantId: string,
    eventId: string,
    notificationId: string,
  ) =>
    `${eventBase(tenantId, eventId)}/notifications/${encodeURIComponent(notificationId)}/retry`,
  exports: (tenantId: string, eventId: string) =>
    `${eventBase(tenantId, eventId)}/exports`,
  exportJob: (tenantId: string, eventId: string, exportId: string) =>
    `${eventBase(tenantId, eventId)}/exports/${encodeURIComponent(exportId)}`,
  exportDownload: (tenantId: string, eventId: string, exportId: string) =>
    `${eventBase(tenantId, eventId)}/exports/${encodeURIComponent(exportId)}/download`,
} as const;
