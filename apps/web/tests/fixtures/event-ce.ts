/**
 * Explicit C-E fixtures mirrored from packages/contracts fixtures/examples.ts
 * (PR #63). Typed against @ticket/contracts — not live acceptance evidence.
 */

import type {
  CancelEventBody,
  CloneEventBody,
  EventDetail,
  EventImpactPreviewResponse,
  PatchEventBody,
} from '@ticket/contracts';
import {
  EVENT_ARCHIVE_COMMAND,
  EVENT_CANCEL_COMMAND,
  EVENT_CLONE_COMMAND,
  EVENT_CREATE_COMMAND,
  EVENT_UPDATE_COMMAND,
} from '@ticket/contracts';

export const fixtureEventCommands = {
  create: EVENT_CREATE_COMMAND,
  update: EVENT_UPDATE_COMMAND,
  clone: EVENT_CLONE_COMMAND,
  archive: EVENT_ARCHIVE_COMMAND,
  cancel: EVENT_CANCEL_COMMAND,
} as const;

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

/** Legacy EventSummary shape — must be rejected by C-E interpreters. */
export const legacyEventSummary = {
  eventId: fixtureEventDetail.eventId,
  slug: fixtureEventDetail.slug,
  name: fixtureEventDetail.name,
  status: 'DRAFT',
  timezone: fixtureEventDetail.timezone,
};
