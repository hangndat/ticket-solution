import type { CreateEventBodyV2, EventVisibility } from '@ticket/contracts';
import {
  EVENT_DETAIL_UNKNOWN,
  interpretEventListDetail,
  interpretEventMutation,
  type EventListDetailView,
  type EventMutationView,
} from './event-lifecycle';

export function createEventUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/events`;
}

export function eventsListUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/events`;
}

/** Create success uses C-E EventDetail (+ optional replayed). */
export type CreateEventView = EventMutationView;

/** List uses C-E EventListPage (items: EventDetail[]). */
export type EventListView = EventListDetailView;

export const CREATE_EVENT_UNKNOWN =
  'Kết quả tạo event chưa biết. Không coi là đã tạo sự kiện.';

export const EVENT_LIST_UNKNOWN = EVENT_DETAIL_UNKNOWN;

/**
 * Strict create interpreter against C-E EventDetail.
 * Rejects legacy EventSummary (`status` without contentStatus/businessStatus).
 */
export function interpretCreateEvent(
  status: number,
  json: unknown,
  networkError: boolean,
): CreateEventView {
  const view = interpretEventMutation(status, json, networkError);
  if (view.kind === 'unknown') {
    return { kind: 'unknown', message: CREATE_EVENT_UNKNOWN };
  }
  return view;
}

export function interpretEventList(
  status: number,
  json: unknown,
  networkError: boolean,
): EventListView {
  return interpretEventListDetail(status, json, networkError);
}

export function createEventLabel(view: CreateEventView): string {
  if (view.kind === 'ok') {
    const e = view.event;
    const replay = view.replayed ? ' (replayed)' : '';
    return `Đã tạo event ${e.eventId} · ${e.slug} (${e.name}) · ${e.contentStatus}/${e.businessStatus}${replay}.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}

export function eventListLabel(view: EventListView): string {
  if (view.kind === 'list') {
    return `Danh sách event: ${view.items.length} mục.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}

const VISIBILITIES: readonly EventVisibility[] = ['PUBLIC', 'UNLISTED'];

export function isEventVisibility(value: unknown): value is EventVisibility {
  return (
    typeof value === 'string' &&
    (VISIBILITIES as readonly string[]).includes(value)
  );
}

/** Allowlisted create body fields for BFF (CreateEventBodyV2). */
export function buildCreateEventUpstreamBody(input: {
  slug: string;
  name: string;
  timezone?: string;
  visibility?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string;
  venueAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
}): CreateEventBodyV2 {
  const body: CreateEventBodyV2 = {
    slug: input.slug.trim(),
    name: input.name.trim(),
  };
  if (input.timezone?.trim()) body.timezone = input.timezone.trim();
  if (isEventVisibility(input.visibility)) body.visibility = input.visibility;
  if (input.startsAt !== undefined) body.startsAt = input.startsAt;
  if (input.endsAt !== undefined) body.endsAt = input.endsAt;
  if (input.venueName?.trim() && input.venueAddress?.trim()) {
    body.venue = {
      name: input.venueName.trim(),
      address: input.venueAddress.trim(),
    };
  }
  const contact: NonNullable<CreateEventBodyV2['contact']> = {};
  if (input.contactEmail?.trim()) contact.email = input.contactEmail.trim();
  if (input.contactPhone?.trim()) contact.phone = input.contactPhone.trim();
  if (input.contactUrl?.trim()) contact.url = input.contactUrl.trim();
  if (Object.keys(contact).length > 0) body.contact = contact;
  if (input.redemptionOpensAt !== undefined) {
    body.redemptionOpensAt = input.redemptionOpensAt;
  }
  if (input.redemptionClosesAt !== undefined) {
    body.redemptionClosesAt = input.redemptionClosesAt;
  }
  if (input.checkInOpensAt !== undefined) {
    body.checkInOpensAt = input.checkInOpensAt;
  }
  if (input.checkInClosesAt !== undefined) {
    body.checkInClosesAt = input.checkInClosesAt;
  }
  if (input.maxTicketsPerAttendee !== undefined) {
    body.maxTicketsPerAttendee = input.maxTicketsPerAttendee;
  }
  return body;
}
