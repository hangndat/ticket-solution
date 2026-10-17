/**
 * C-E — Event metadata & lifecycle (frozen transport).
 * contentStatus vs businessStatus are independent.
 * Windows are half-open [opensAt, closesAt); null bound = unbounded on that side.
 */

import type { CursorPage } from './common';

export type EventContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type EventBusinessStatus = 'ACTIVE' | 'CANCELLED';
export type EventVisibility = 'PUBLIC' | 'UNLISTED';

/** Half-open UTC window. Server decides with DB clock after row lock. */
export interface EventWindow {
  opensAt: string | null;
  closesAt: string | null;
}

export interface EventVenue {
  /** Bounded display name. */
  name: string;
  /** Bounded plain-text address (no HTML). */
  address: string;
}

/** Allowlisted contact projection — no arbitrary HTML/JS. */
export interface EventContact {
  email?: string;
  phone?: string;
  url?: string;
}

export interface EventDetail {
  eventId: string;
  tenantId: string;
  slug: string;
  name: string;
  contentStatus: EventContentStatus;
  businessStatus: EventBusinessStatus;
  visibility: EventVisibility;
  /** IANA timezone id. */
  timezone: string;
  /** Explicit UTC ISO-8601 with offset/Z. */
  startsAt: string | null;
  endsAt: string | null;
  venue: EventVenue | null;
  contact: EventContact | null;
  redemptionWindow: EventWindow;
  checkInWindow: EventWindow;
  /** Optimistic concurrency token for metadata mutations. */
  revision: number;
  /**
   * Per-attendee ticket cap for the event. null = unlimited (new events).
   * Legacy backfill may retain a prior numeric default with explicit label in UI.
   */
  maxTicketsPerAttendee: number | null;
}

/** Extends create with optional metadata; existing create stays compatible. */
export interface CreateEventBodyV2 {
  slug: string;
  name: string;
  timezone?: string;
  visibility?: EventVisibility;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: EventVenue | null;
  contact?: EventContact | null;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
}

export interface PatchEventBody {
  expectedRevision: number;
  name?: string;
  timezone?: string;
  visibility?: EventVisibility;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: EventVenue | null;
  contact?: EventContact | null;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
  /**
   * Required when patch changes startsAt/venue after tickets exist and
   * impact-preview reported affectedCount > 0.
   */
  confirmIssuedImpact?: true;
  notifyAttendees?: boolean;
}

export interface CloneEventBody {
  slug: string;
  name: string;
  /** Copy allowlisted config versions / typed content refs; default false for inventory. */
  copyConfig?: boolean;
}

export interface CancelEventBody {
  expectedRevision: number;
  reason: string;
  notifyAttendees?: boolean;
}

export interface ArchiveEventBody {
  expectedRevision: number;
}

export interface EventImpactPreviewRequest {
  expectedRevision: number;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: EventVenue | null;
}

export interface EventImpactPreviewResponse {
  revision: number;
  affectedTicketCount: number;
  requiresConfirm: boolean;
  diff: {
    field: 'startsAt' | 'endsAt' | 'venue';
    from: string | null;
    to: string | null;
  }[];
}

export interface EventListPage extends CursorPage<EventDetail> {}

export const EVENT_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  INVALID_WINDOW: 'INVALID_WINDOW',
  INVALID_VISIBILITY: 'INVALID_VISIBILITY',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_ARCHIVED: 'EVENT_ARCHIVED',
  EVENT_CLOSED: 'EVENT_CLOSED',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  REDEMPTION_WINDOW_CLOSED: 'REDEMPTION_WINDOW_CLOSED',
  IMPACT_CONFIRM_REQUIRED: 'IMPACT_CONFIRM_REQUIRED',
  CLONE_NOT_DRAFT: 'CLONE_NOT_DRAFT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type EventErrorCode =
  (typeof EVENT_ERROR_CODES)[keyof typeof EVENT_ERROR_CODES];

/**
 * Route templates under API_VERSION prefix (`/v1`).
 * Controllers implement these in later BE tasks — shapes frozen for consumers.
 */
export const EVENT_ENDPOINTS = {
  create: 'POST /tenants/:tenantId/events',
  list: 'GET /tenants/:tenantId/events',
  get: 'GET /tenants/:tenantId/events/:eventId',
  patch: 'PATCH /tenants/:tenantId/events/:eventId',
  clone: 'POST /tenants/:tenantId/events/:eventId/clone',
  archive: 'POST /tenants/:tenantId/events/:eventId/archive',
  cancel: 'POST /tenants/:tenantId/events/:eventId/cancel',
  impactPreview: 'POST /tenants/:tenantId/events/:eventId/impact-preview',
} as const;
