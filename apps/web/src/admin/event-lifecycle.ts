/**
 * C-E event metadata / lifecycle helpers — exact shapes from @ticket/contracts.
 * Interpreters are fail-closed: unknown/5xx/network never look like success.
 */

import {
  EVENT_ENDPOINTS,
  type ArchiveEventBody,
  type CancelEventBody,
  type CloneEventBody,
  type EventBusinessStatus,
  type EventContact,
  type EventContentStatus,
  type EventDetail,
  type EventImpactPreviewRequest,
  type EventImpactPreviewResponse,
  type EventVenue,
  type EventVisibility,
  type EventWindow,
  type PatchEventBody,
} from '@ticket/contracts';
import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  optionalNumber,
  optionalString,
} from './contract-shape';
import type { AdminScope } from './scope';

export const EVENT_DETAIL_UNKNOWN =
  'Kết quả event chưa biết. Không hiện metadata theo shape sai.';
export const EVENT_MUTATION_UNKNOWN =
  'Kết quả thao tác event chưa biết. Không coi là đã cập nhật.';
export const EVENT_IMPACT_UNKNOWN =
  'Kết quả impact preview chưa biết. Không xác nhận đổi giờ/địa điểm.';

const CONTENT_STATUSES: readonly EventContentStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
];
const BUSINESS_STATUSES: readonly EventBusinessStatus[] = [
  'ACTIVE',
  'CANCELLED',
];
const VISIBILITIES: readonly EventVisibility[] = ['PUBLIC', 'UNLISTED'];
const IMPACT_FIELDS = ['startsAt', 'endsAt', 'venue'] as const;

function isContentStatus(value: unknown): value is EventContentStatus {
  return (
    typeof value === 'string' &&
    (CONTENT_STATUSES as readonly string[]).includes(value)
  );
}

function isBusinessStatus(value: unknown): value is EventBusinessStatus {
  return (
    typeof value === 'string' &&
    (BUSINESS_STATUSES as readonly string[]).includes(value)
  );
}

function isVisibility(value: unknown): value is EventVisibility {
  return (
    typeof value === 'string' &&
    (VISIBILITIES as readonly string[]).includes(value)
  );
}

function parseWindow(value: unknown): EventWindow | null {
  const row = asRecord(value);
  if (!row) return null;
  const opensAt =
    row.opensAt === null
      ? null
      : isNonEmptyString(row.opensAt)
        ? row.opensAt.trim()
        : undefined;
  const closesAt =
    row.closesAt === null
      ? null
      : isNonEmptyString(row.closesAt)
        ? row.closesAt.trim()
        : undefined;
  if (opensAt === undefined || closesAt === undefined) return null;
  return { opensAt, closesAt };
}

function parseVenue(value: unknown): EventVenue | null | undefined {
  if (value === null) return null;
  const row = asRecord(value);
  if (!row) return undefined;
  if (!isNonEmptyString(row.name) || !isNonEmptyString(row.address)) {
    return undefined;
  }
  return { name: row.name.trim(), address: row.address.trim() };
}

function parseContact(value: unknown): EventContact | null | undefined {
  if (value === null) return null;
  const row = asRecord(value);
  if (!row) return undefined;
  const contact: EventContact = {};
  if (row.email !== undefined) {
    if (!isNonEmptyString(row.email)) return undefined;
    contact.email = row.email.trim();
  }
  if (row.phone !== undefined) {
    if (!isNonEmptyString(row.phone)) return undefined;
    contact.phone = row.phone.trim();
  }
  if (row.url !== undefined) {
    if (!isNonEmptyString(row.url)) return undefined;
    contact.url = row.url.trim();
  }
  return contact;
}

function nullableIso(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (isNonEmptyString(value)) return value.trim();
  return undefined;
}

/** Strict EventDetail parser (C-E). Rejects legacy `status` summaries. */
export function parseEventDetail(json: unknown): EventDetail | null {
  const body = asRecord(json);
  if (!body) return null;
  if (
    !isNonEmptyString(body.eventId) ||
    !isNonEmptyString(body.tenantId) ||
    !isNonEmptyString(body.slug) ||
    !isNonEmptyString(body.name) ||
    !isContentStatus(body.contentStatus) ||
    !isBusinessStatus(body.businessStatus) ||
    !isVisibility(body.visibility) ||
    !isNonEmptyString(body.timezone)
  ) {
    return null;
  }
  const startsAt = nullableIso(body.startsAt);
  const endsAt = nullableIso(body.endsAt);
  if (startsAt === undefined || endsAt === undefined) return null;
  const venue = parseVenue(body.venue);
  if (venue === undefined) return null;
  const contact = parseContact(body.contact);
  if (contact === undefined) return null;
  const redemptionWindow = parseWindow(body.redemptionWindow);
  const checkInWindow = parseWindow(body.checkInWindow);
  if (!redemptionWindow || !checkInWindow) return null;
  const revision = optionalNumber(body.revision);
  if (revision === null || !Number.isInteger(revision) || revision < 0) {
    return null;
  }
  let maxTicketsPerAttendee: number | null;
  if (body.maxTicketsPerAttendee === null) {
    maxTicketsPerAttendee = null;
  } else {
    const cap = optionalNumber(body.maxTicketsPerAttendee);
    if (cap === null || !Number.isInteger(cap) || cap < 1) return null;
    maxTicketsPerAttendee = cap;
  }
  return {
    eventId: body.eventId.trim(),
    tenantId: body.tenantId.trim(),
    slug: body.slug.trim(),
    name: body.name.trim(),
    contentStatus: body.contentStatus,
    businessStatus: body.businessStatus,
    visibility: body.visibility,
    timezone: body.timezone.trim(),
    startsAt,
    endsAt,
    venue,
    contact,
    redemptionWindow,
    checkInWindow,
    revision,
    maxTicketsPerAttendee,
  };
}

export type EventDetailView =
  | { kind: 'detail'; event: EventDetail; replayed: boolean | null }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type EventListDetailView =
  | {
      kind: 'list';
      items: EventDetail[];
      nextCursor: string | null;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type EventMutationView =
  | { kind: 'ok'; event: EventDetail; replayed: boolean | null }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type EventImpactView =
  | { kind: 'preview'; preview: EventImpactPreviewResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function interpretDetailStatus(
  status: number,
  json: unknown,
  networkError: boolean,
  unknownMessage: string,
): EventDetailView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: unknownMessage };
  }
  const body = asRecord(json);
  if (status === 200 || status === 201) {
    const event = parseEventDetail(body);
    if (event) {
      return {
        kind: 'detail',
        event,
        replayed: typeof body?.replayed === 'boolean' ? body.replayed : null,
      };
    }
    return { kind: 'unknown', message: unknownMessage };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: unknownMessage };
}

export function interpretEventDetail(
  status: number,
  json: unknown,
  networkError: boolean,
): EventDetailView {
  return interpretDetailStatus(
    status,
    json,
    networkError,
    EVENT_DETAIL_UNKNOWN,
  );
}

export function interpretEventMutation(
  status: number,
  json: unknown,
  networkError: boolean,
): EventMutationView {
  const view = interpretDetailStatus(
    status,
    json,
    networkError,
    EVENT_MUTATION_UNKNOWN,
  );
  if (view.kind === 'detail') {
    return { kind: 'ok', event: view.event, replayed: view.replayed };
  }
  return view;
}

export function interpretEventListDetail(
  status: number,
  json: unknown,
  networkError: boolean,
): EventListDetailView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EVENT_DETAIL_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body && Array.isArray(body.items)) {
    const items: EventDetail[] = [];
    for (const row of body.items) {
      const detail = parseEventDetail(row);
      if (!detail) {
        return { kind: 'unknown', message: EVENT_DETAIL_UNKNOWN };
      }
      items.push(detail);
    }
    const nextCursor =
      body.nextCursor === null
        ? null
        : optionalString(body.nextCursor)?.trim() ?? null;
    if (body.nextCursor !== null && body.nextCursor !== undefined) {
      if (typeof body.nextCursor !== 'string') {
        return { kind: 'unknown', message: EVENT_DETAIL_UNKNOWN };
      }
    }
    return { kind: 'list', items, nextCursor };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EVENT_DETAIL_UNKNOWN };
}

function parseImpactDiff(
  value: unknown,
): EventImpactPreviewResponse['diff'] | null {
  if (!Array.isArray(value)) return null;
  const diff: EventImpactPreviewResponse['diff'] = [];
  for (const row of value) {
    const item = asRecord(row);
    if (!item) return null;
    if (
      typeof item.field !== 'string' ||
      !(IMPACT_FIELDS as readonly string[]).includes(item.field)
    ) {
      return null;
    }
    const from =
      item.from === null
        ? null
        : isNonEmptyString(item.from)
          ? item.from.trim()
          : undefined;
    const to =
      item.to === null
        ? null
        : isNonEmptyString(item.to)
          ? item.to.trim()
          : undefined;
    if (from === undefined || to === undefined) return null;
    diff.push({
      field: item.field as 'startsAt' | 'endsAt' | 'venue',
      from,
      to,
    });
  }
  return diff;
}

export function parseImpactPreview(
  json: unknown,
): EventImpactPreviewResponse | null {
  const body = asRecord(json);
  if (!body) return null;
  const revision = optionalNumber(body.revision);
  const affectedTicketCount = optionalNumber(body.affectedTicketCount);
  if (
    revision === null ||
    !Number.isInteger(revision) ||
    affectedTicketCount === null ||
    !Number.isInteger(affectedTicketCount) ||
    affectedTicketCount < 0 ||
    typeof body.requiresConfirm !== 'boolean'
  ) {
    return null;
  }
  const diff = parseImpactDiff(body.diff);
  if (!diff) return null;
  return {
    revision,
    affectedTicketCount,
    requiresConfirm: body.requiresConfirm,
    diff,
  };
}

export function interpretEventImpactPreview(
  status: number,
  json: unknown,
  networkError: boolean,
): EventImpactView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EVENT_IMPACT_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200) {
    const preview = parseImpactPreview(body);
    if (preview) return { kind: 'preview', preview };
    return { kind: 'unknown', message: EVENT_IMPACT_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EVENT_IMPACT_UNKNOWN };
}

export function eventDetailUpstreamPath(scope: AdminScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}`;
}

export function eventCloneUpstreamPath(scope: AdminScope): string {
  return `${eventDetailUpstreamPath(scope)}/clone`;
}

export function eventArchiveUpstreamPath(scope: AdminScope): string {
  return `${eventDetailUpstreamPath(scope)}/archive`;
}

export function eventCancelUpstreamPath(scope: AdminScope): string {
  return `${eventDetailUpstreamPath(scope)}/cancel`;
}

export function eventImpactPreviewUpstreamPath(scope: AdminScope): string {
  return `${eventDetailUpstreamPath(scope)}/impact-preview`;
}

/** Compile-time guard that BFF paths stay aligned with frozen EVENT_ENDPOINTS. */
export const EVENT_BFF_ENDPOINT_GUARD = EVENT_ENDPOINTS;

export function eventDetailLabel(view: EventDetailView): string {
  if (view.kind === 'detail') {
    const e = view.event;
    const replay = view.replayed ? ' (replayed)' : '';
    return `Event ${e.slug} · ${e.contentStatus}/${e.businessStatus} · rev ${e.revision}${replay}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function eventMutationLabel(view: EventMutationView): string {
  if (view.kind === 'ok') {
    const e = view.event;
    const replay = view.replayed ? ' (replayed)' : '';
    return `Đã cập nhật ${e.slug} · ${e.contentStatus}/${e.businessStatus} · rev ${e.revision}${replay}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function eventImpactLabel(view: EventImpactView): string {
  if (view.kind === 'preview') {
    const p = view.preview;
    return `Impact: ${p.affectedTicketCount} vé · confirm=${p.requiresConfirm ? 'cần' : 'không'} · rev ${p.revision}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function eventListDetailLabel(view: EventListDetailView): string {
  if (view.kind === 'list') {
    return `Danh sách event (C-E): ${view.items.length} mục.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

/** Build PatchEventBody from editor fields; omit empty optional strings. */
export function buildPatchEventBody(input: {
  expectedRevision: number;
  name?: string;
  timezone?: string;
  visibility?: EventVisibility;
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
  confirmIssuedImpact?: boolean;
  notifyAttendees?: boolean;
  clearVenue?: boolean;
  clearContact?: boolean;
}): PatchEventBody {
  const body: PatchEventBody = {
    expectedRevision: input.expectedRevision,
  };
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.timezone?.trim()) body.timezone = input.timezone.trim();
  if (input.visibility) body.visibility = input.visibility;
  if (input.startsAt !== undefined) body.startsAt = input.startsAt;
  if (input.endsAt !== undefined) body.endsAt = input.endsAt;
  if (input.clearVenue) {
    body.venue = null;
  } else if (input.venueName?.trim() && input.venueAddress?.trim()) {
    body.venue = {
      name: input.venueName.trim(),
      address: input.venueAddress.trim(),
    };
  }
  if (input.clearContact) {
    body.contact = null;
  } else {
    const contact: EventContact = {};
    if (input.contactEmail?.trim()) contact.email = input.contactEmail.trim();
    if (input.contactPhone?.trim()) contact.phone = input.contactPhone.trim();
    if (input.contactUrl?.trim()) contact.url = input.contactUrl.trim();
    if (Object.keys(contact).length > 0) body.contact = contact;
  }
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
  if (input.confirmIssuedImpact === true) {
    body.confirmIssuedImpact = true;
  }
  if (typeof input.notifyAttendees === 'boolean') {
    body.notifyAttendees = input.notifyAttendees;
  }
  return body;
}

export function buildCloneEventBody(input: {
  slug: string;
  name: string;
  copyConfig?: boolean;
}): CloneEventBody {
  return {
    slug: input.slug.trim(),
    name: input.name.trim(),
    ...(input.copyConfig ? { copyConfig: true } : {}),
  };
}

export function buildCancelEventBody(input: {
  expectedRevision: number;
  reason: string;
  notifyAttendees?: boolean;
}): CancelEventBody {
  return {
    expectedRevision: input.expectedRevision,
    reason: input.reason.trim(),
    ...(typeof input.notifyAttendees === 'boolean'
      ? { notifyAttendees: input.notifyAttendees }
      : {}),
  };
}

export function buildArchiveEventBody(
  expectedRevision: number,
): ArchiveEventBody {
  return { expectedRevision };
}

export function buildImpactPreviewRequest(input: {
  expectedRevision: number;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string;
  venueAddress?: string;
  clearVenue?: boolean;
}): EventImpactPreviewRequest {
  const body: EventImpactPreviewRequest = {
    expectedRevision: input.expectedRevision,
  };
  if (input.startsAt !== undefined) body.startsAt = input.startsAt;
  if (input.endsAt !== undefined) body.endsAt = input.endsAt;
  if (input.clearVenue) {
    body.venue = null;
  } else if (input.venueName?.trim() && input.venueAddress?.trim()) {
    body.venue = {
      name: input.venueName.trim(),
      address: input.venueAddress.trim(),
    };
  }
  return body;
}

/** True when patch may affect issued tickets (startsAt / venue change). */
export function patchMayAffectIssuedTickets(
  current: EventDetail | null,
  next: {
    startsAt?: string | null;
    venueName?: string;
    venueAddress?: string;
    clearVenue?: boolean;
  },
): boolean {
  if (!current) return Boolean(next.startsAt || next.venueName || next.clearVenue);
  if (next.startsAt !== undefined && next.startsAt !== current.startsAt) {
    return true;
  }
  if (next.clearVenue && current.venue !== null) return true;
  if (next.venueName?.trim() && next.venueAddress?.trim()) {
    const name = next.venueName.trim();
    const address = next.venueAddress.trim();
    if (!current.venue || current.venue.name !== name || current.venue.address !== address) {
      return true;
    }
  }
  return false;
}
