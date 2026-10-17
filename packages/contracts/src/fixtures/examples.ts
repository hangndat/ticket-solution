/**
 * Typed fixtures for C-E / C-B / C-I / C-F / C-N.
 * Compile-only examples — not production data and not live acceptance evidence.
 */

import {
  REDEMPTION_COMMAND,
  REDEMPTION_APPROVE_COMMAND,
  EVENT_CLONE_COMMAND,
  OFFLINE_SYNC_COMMAND,
} from '../commands';
import type {
  OfflineSyncRequestBody,
  OfflineSyncResponse,
} from '../offline-sync';
import {
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_PAYLOAD_VERSION,
} from '../offline-sync';
import type {
  CancelEventBody,
  CloneEventBody,
  EventDetail,
  EventImpactPreviewResponse,
  PatchEventBody,
} from '../events';
import type {
  AssetFinalizeResponse,
  ConfigPreviewResponse,
  ConfigRollbackBody,
  EventConfigPayload,
} from '../config';
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
  InvitationClaimBody,
  InvitationDispatchPreviewResponse,
} from '../import-invite';
import type {
  FormDefinition,
  OwnerRedemptionStatus,
  RedeemMutationResult,
  RedeemRequestBodyV2,
  StaffPendingRedemptionPage,
} from '../redemption-forms';
import { APPROVAL_PENDING, FORM_LIMITS } from '../redemption-forms';
import type {
  NotificationSummary,
  ReminderPreviewResponse,
  NotificationTemplatePreviewResponse,
} from '../notifications';
import { NOTIFICATION_KINDS } from '../notifications';

export const fixtureCommands = {
  redeem: REDEMPTION_COMMAND,
  approve: REDEMPTION_APPROVE_COMMAND,
  clone: EVENT_CLONE_COMMAND,
  offlineSync: OFFLINE_SYNC_COMMAND,
} as const;

export const fixtureOfflineSyncRequest: OfflineSyncRequestBody = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  staffSessionId: '33333333-3333-4333-8333-333333333333',
  deviceId: '44444444-4444-4444-8444-444444444444',
  clientClockAt: '2026-11-01T09:05:00.000Z',
  events: [
    {
      clientEventId: '55555555-5555-4555-8555-555555555555',
      type: 'CHECKIN_OFFLINE',
      eventId: '11111111-1111-4111-8111-111111111111',
      ticketId: '99999999-9999-4999-8999-999999999999',
      clientOccurredAt: '2026-11-01T09:04:30.000Z',
      clientSeq: 0,
      payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
    },
  ],
};

export const fixtureOfflineSyncResponse: OfflineSyncResponse = {
  serverTime: '2026-11-01T09:05:01.000Z',
  maxClockSkewSeconds: OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  results: [
    {
      clientEventId: '55555555-5555-4555-8555-555555555555',
      status: 'APPLIED',
      checkinId: '66666666-6666-4666-8666-666666666666',
    },
  ],
};

export const fixtureEventDetail: EventDetail = {
  eventId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  slug: 'spring-gala',
  name: 'Spring Gala',
  contentStatus: 'DRAFT',
  businessStatus: 'ACTIVE',
  visibility: 'UNLISTED',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2026-11-01T10:00:00.000Z',
  endsAt: '2026-11-01T14:00:00.000Z',
  venue: { name: 'Hall A', address: '1 Example St' },
  contact: { email: 'ops@example.com' },
  redemptionWindow: {
    opensAt: '2026-10-01T00:00:00.000Z',
    closesAt: '2026-11-01T10:00:00.000Z',
  },
  checkInWindow: {
    opensAt: '2026-11-01T08:00:00.000Z',
    closesAt: '2026-11-01T16:00:00.000Z',
  },
  revision: 3,
  maxTicketsPerAttendee: 2,
};

export const fixturePatchEvent: PatchEventBody = {
  expectedRevision: 3,
  startsAt: '2026-11-01T11:00:00.000Z',
  confirmIssuedImpact: true,
  notifyAttendees: true,
};

export const fixtureCloneEvent: CloneEventBody = {
  slug: 'spring-gala-copy',
  name: 'Spring Gala (copy)',
  copyConfig: true,
};

export const fixtureCancelEvent: CancelEventBody = {
  expectedRevision: 3,
  reason: 'Venue unavailable',
  notifyAttendees: true,
};

export const fixtureImpactPreview: EventImpactPreviewResponse = {
  revision: 3,
  affectedTicketCount: 12,
  requiresConfirm: true,
  diff: [
    {
      field: 'startsAt',
      from: '2026-11-01T10:00:00.000Z',
      to: '2026-11-01T11:00:00.000Z',
    },
  ],
};

export const fixtureConfigPayload: EventConfigPayload = {
  schemaVersion: 1,
  brand: {
    primaryColor: '#0B3D2E',
    organizationName: 'Example Org',
  },
  sections: [
    {
      kind: 'hero',
      id: 'hero-1',
      visible: true,
      order: 0,
      body: { title: 'Welcome' },
    },
    {
      kind: 'terms',
      id: 'terms-1',
      visible: true,
      order: 5,
      body: { termsVersion: 'terms-v1' },
    },
  ],
  formDefinitionId: 'form-v1',
  termsVersion: 'terms-v1',
};

export const fixtureConfigPreview: ConfigPreviewResponse = {
  eventId: fixtureEventDetail.eventId,
  version: 2,
  schemaVersion: 1,
  payload: fixtureConfigPayload,
  cacheControl: 'no-store',
};

export const fixtureRollback: ConfigRollbackBody = {
  targetVersion: 1,
  expectedPublishedVersion: 2,
  expectedRevision: 3,
};

export const fixtureAssetReady: AssetFinalizeResponse = {
  assetId: '33333333-3333-4333-8333-333333333333',
  status: 'READY',
  widthPx: 1200,
  heightPx: 630,
  byteLength: 102_400,
  contentType: 'image/png',
};

export const fixtureImportPreview: ImportPreviewResponse = {
  importId: '44444444-4444-4444-8444-444444444444',
  previewRevision: 1,
  mappingRevision: 1,
  fileHash: 'sha256:deadbeef',
  validRowCount: 98,
  errorRowCount: 2,
  invitationCount: 0,
  estimatedQuota: 98,
  sampleErrors: [
    {
      fieldId: 'row:3:code',
      code: 'DUPLICATE_IN_EVENT',
      message: 'Duplicate code in event',
    },
  ],
};

export const fixtureImportCommit: ImportCommitResponse = {
  importId: fixtureImportPreview.importId,
  status: 'COMPLETED',
  committedRowCount: 98,
  skippedRowCount: 0,
  errorRowCount: 2,
  invitationCount: 0,
  replayed: false,
};

export const fixtureDispatchPreview: InvitationDispatchPreviewResponse = {
  previewRevision: 1,
  selectedCount: 10,
  estimatedQuota: 10,
};

export const fixtureInvitationClaim: InvitationClaimBody = {
  token: 'opaque-one-time-token',
  formVersion: 'form-v1',
  termsVersion: 'terms-v1',
  answers: { full_name: 'Ada Lovelace', agree: true },
  termsAccepted: true,
};

export const fixtureFormDefinition: FormDefinition = {
  formVersion: 'form-v1',
  fields: [
    {
      id: 'full_name',
      label: 'Full name',
      type: 'text',
      required: true,
    },
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      id: 'phone',
      label: 'Phone',
      type: 'phone',
      required: false,
    },
    {
      id: 'shirt',
      label: 'Shirt size',
      type: 'select',
      required: true,
      options: [
        { id: 's', label: 'S' },
        { id: 'm', label: 'M' },
      ],
    },
    {
      id: 'agree',
      label: 'I agree',
      type: 'checkbox',
      required: true,
    },
  ],
};

/** Valid answers covering all five field types. */
export const fixtureValidAnswers: RedeemRequestBodyV2 = {
  code: 'SAMPLE-CODE',
  formVersion: 'form-v1',
  termsVersion: 'terms-v1',
  answers: {
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+84 90 123 4567',
    shirt: 'm',
    agree: true,
  },
  termsAccepted: true,
};

/** Invalid: unknown field, forged select, checkbox false, oversize text. */
export const fixtureInvalidAnswers: RedeemRequestBodyV2 = {
  code: 'SAMPLE-CODE',
  formVersion: 'form-v1',
  termsVersion: 'terms-v1',
  answers: {
    full_name: 'x'.repeat(FORM_LIMITS.maxTextLength + 1),
    email: 'not-an-email',
    phone: '1',
    shirt: 'forged-option',
    agree: false,
    unknown_field: 'nope',
  },
  termsAccepted: true,
};

export const fixtureRedeemPending: RedeemMutationResult = {
  code: APPROVAL_PENDING,
  requestId: '55555555-5555-4555-8555-555555555555',
  operationId: '66666666-6666-4666-8666-666666666666',
  eventId: fixtureEventDetail.eventId,
  ticketTypeId: '77777777-7777-4777-8777-777777777777',
  sourceId: '88888888-8888-4888-8888-888888888888',
  status: 'PENDING_REVIEW',
  expiresAt: '2026-10-18T10:00:00.000Z',
  replayed: false,
};

export const fixtureRedeemIssued: RedeemMutationResult = {
  ticketId: '99999999-9999-4999-8999-999999999999',
  requestId: '55555555-5555-4555-8555-555555555555',
  operationId: '66666666-6666-4666-8666-666666666666',
  eventId: fixtureEventDetail.eventId,
  ticketTypeId: '77777777-7777-4777-8777-777777777777',
  sourceId: '88888888-8888-4888-8888-888888888888',
  state: 'ACTIVE',
  credentialVersion: 1,
  replayed: false,
};

export const fixtureOwnerStatuses: OwnerRedemptionStatus[] = [
  {
    status: 'PENDING_REVIEW',
    requestId: '55555555-5555-4555-8555-555555555555',
    eventId: fixtureEventDetail.eventId,
    ticketTypeId: '77777777-7777-4777-8777-777777777777',
    sourceId: '88888888-8888-4888-8888-888888888888',
    expiresAt: '2026-10-18T10:00:00.000Z',
    submittedAt: '2026-10-17T10:00:00.000Z',
  },
  {
    status: 'ISSUED',
    requestId: '55555555-5555-4555-8555-555555555555',
    eventId: fixtureEventDetail.eventId,
    ticketId: '99999999-9999-4999-8999-999999999999',
    ticketTypeId: '77777777-7777-4777-8777-777777777777',
    sourceId: '88888888-8888-4888-8888-888888888888',
    issuedAt: '2026-10-17T11:00:00.000Z',
  },
  {
    status: 'REJECTED',
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    eventId: fixtureEventDetail.eventId,
    ticketTypeId: '77777777-7777-4777-8777-777777777777',
    sourceId: '88888888-8888-4888-8888-888888888888',
    reason: 'Incomplete registration',
    decidedAt: '2026-10-17T12:00:00.000Z',
  },
  {
    status: 'EXPIRED',
    requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    eventId: fixtureEventDetail.eventId,
    ticketTypeId: '77777777-7777-4777-8777-777777777777',
    sourceId: '88888888-8888-4888-8888-888888888888',
    expiredAt: '2026-10-18T10:00:00.000Z',
  },
];

export const fixtureStaffPendingPage: StaffPendingRedemptionPage = {
  items: [
    {
      requestId: '55555555-5555-4555-8555-555555555555',
      eventId: fixtureEventDetail.eventId,
      ticketTypeId: '77777777-7777-4777-8777-777777777777',
      sourceId: '88888888-8888-4888-8888-888888888888',
      status: 'PENDING_REVIEW',
      expiresAt: '2026-10-18T10:00:00.000Z',
      submittedAt: '2026-10-17T10:00:00.000Z',
      actorEmailMasked: 'a***@example.com',
    },
  ],
  nextCursor: null,
};

export const fixtureNotification: NotificationSummary = {
  notificationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  kind: NOTIFICATION_KINDS[0],
  payloadVersion: 1,
  channel: 'email',
  providerStatus: 'ACCEPTED',
  attempts: 1,
  nextAttemptAt: null,
};

export const fixtureTemplatePreview: NotificationTemplatePreviewResponse = {
  subject: 'Your ticket',
  bodyText: 'Hello Ada',
  bodyHtml: '<p>Hello Ada</p>',
  escaped: true,
};

export const fixtureReminderPreview: ReminderPreviewResponse = {
  recipientCount: 42,
  scheduledAt: '2026-10-31T01:00:00.000Z',
  eventRevision: 3,
};

/** Assert command freeze at module load (compile + runtime guard in tests). */
export function assertRedemptionCommandFrozen(): typeof REDEMPTION_COMMAND {
  if (REDEMPTION_COMMAND !== 'redemption.redeem') {
    throw new Error('REDEMPTION_COMMAND drift');
  }
  return REDEMPTION_COMMAND;
}

export function assertOfflineSyncCommandFrozen(): typeof OFFLINE_SYNC_COMMAND {
  if (OFFLINE_SYNC_COMMAND !== 'gate.offline_sync') {
    throw new Error('OFFLINE_SYNC_COMMAND drift');
  }
  return OFFLINE_SYNC_COMMAND;
}
