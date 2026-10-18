import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  CURSOR_PAGE_LIMIT,
  EVENT_ARCHIVE_COMMAND,
  EVENT_CANCEL_COMMAND,
  EVENT_CLONE_COMMAND,
  EVENT_CREATE_COMMAND,
  EVENT_UPDATE_COMMAND,
  type CancelEventBody,
  type CloneEventBody,
  type CreateEventBodyV2,
  type EventDetail,
  type EventImpactPreviewRequest,
  type EventImpactPreviewResponse,
  type PatchEventBody,
  type PortalSourcesPage,
  type PortalTicketTypesPage,
} from '@ticket/contracts';
import { EventError, EVENT_ERROR_CODES } from './event-error';
import {
  EventAdminError,
  EVENT_ADMIN_ERROR_CODES,
} from './event-admin-error';
import { canEnqueueOutboxKind, dbClock } from './event-policy';
import {
  grantEventAssignment,
  requireTenantPermission,
} from './membership';
import { assertTenantAllowsAdminMutation, lockTenantPolicyForShare } from './tenant-policy';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';

const PERMISSION_CREATE = 'event.create';
const PERMISSION_UPDATE = 'event.update';
const PERMISSION_CONFIG = 'event.config';

/** Management allowlist granted to event creator (not client-supplied). */
export type EventSummary = {
  eventId: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
};

export const CREATOR_EVENT_PERMISSIONS = [
  'event.config',
  'event.publish',
  'inventory.import',
  'redemption.approve',
  'report.read',
  'cs.lookup',
  'cs.resend',
  'export.create',
  'export.download',
  'gate.confirm',
  'gate.undo',
  'ticket.revoke',
] as const;

const APPROVAL_MODES = new Set(['AUTO', 'MANUAL']);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 200;
const MAX_VENUE_NAME = 200;
const MAX_VENUE_ADDRESS = 500;
const MAX_CONTACT = 254;
const MAX_CANCEL_REASON = 500;

type EventRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  content_status: string;
  business_status: string;
  visibility: string;
  timezone: string;
  starts_at: Date | null;
  ends_at: Date | null;
  venue_name: string | null;
  venue_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_url: string | null;
  redemption_opens_at: Date | null;
  redemption_closes_at: Date | null;
  check_in_opens_at: Date | null;
  check_in_closes_at: Date | null;
  revision: number;
  max_tickets_per_attendee: number | null;
};

type OperationRow = {
  id: string;
  request_hash: string;
  status: string;
  response_json: Prisma.JsonValue | null;
};

export type EventMutationResult = {
  event: EventDetail;
  operationId: string;
  replayed: boolean;
};

function requireIdempotencyKey(key: string | undefined): string {
  const trimmed = key?.trim() ?? '';
  if (!UUID_RE.test(trimmed)) {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
    );
  }
  return trimmed;
}

function assertValidSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed || trimmed.length > 64 || !SLUG_RE.test(trimmed)) {
    throw new EventError(EVENT_ERROR_CODES.INVALID_SLUG, 'Invalid event slug');
  }
  return trimmed;
}

function assertValidTimezone(timezone: string): string {
  const trimmed = timezone.trim();
  if (!trimmed || trimmed.length > 64) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_TIMEZONE,
      'Invalid IANA timezone',
    );
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed });
  } catch {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_TIMEZONE,
      'Invalid IANA timezone',
    );
  }
  return trimmed;
}

function parseUtcInstant(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} must be UTC ISO-8601 with offset`,
    );
  }
  // Require explicit offset / Z (reject naive local datetimes).
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} must include timezone offset or Z`,
    );
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} is not a valid instant`,
    );
  }
  return date;
}

function assertWindowOrder(
  opensAt: Date | null | undefined,
  closesAt: Date | null | undefined,
  label: string,
): void {
  if (
    opensAt instanceof Date &&
    closesAt instanceof Date &&
    !(closesAt > opensAt)
  ) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${label} closesAt must be after opensAt`,
    );
  }
}

function assertVisibility(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value !== 'PUBLIC' && value !== 'UNLISTED') {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_VISIBILITY,
      'visibility must be PUBLIC or UNLISTED',
    );
  }
  return value;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapEventDetail(row: EventRow): EventDetail {
  const venue =
    row.venue_name && row.venue_address
      ? { name: row.venue_name, address: row.venue_address }
      : null;
  const contact =
    row.contact_email || row.contact_phone || row.contact_url
      ? {
          ...(row.contact_email ? { email: row.contact_email } : {}),
          ...(row.contact_phone ? { phone: row.contact_phone } : {}),
          ...(row.contact_url ? { url: row.contact_url } : {}),
        }
      : null;
  return {
    eventId: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    contentStatus: row.content_status as EventDetail['contentStatus'],
    businessStatus: row.business_status as EventDetail['businessStatus'],
    visibility: row.visibility as EventDetail['visibility'],
    timezone: row.timezone,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    venue,
    contact,
    redemptionWindow: {
      opensAt: iso(row.redemption_opens_at),
      closesAt: iso(row.redemption_closes_at),
    },
    checkInWindow: {
      opensAt: iso(row.check_in_opens_at),
      closesAt: iso(row.check_in_closes_at),
    },
    revision: row.revision,
    maxTicketsPerAttendee: row.max_tickets_per_attendee,
  };
}

function canonicalHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Deterministic event id so create/clone can replay via operations unique key. */
export function deterministicEventId(parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function selectEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  forUpdate = false,
): Promise<EventRow | undefined> {
  if (forUpdate) {
    const rows = await tx.$queryRaw<EventRow[]>`
      SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
             timezone, starts_at, ends_at, venue_name, venue_address,
             contact_email, contact_phone, contact_url,
             redemption_opens_at, redemption_closes_at,
             check_in_opens_at, check_in_closes_at,
             revision, max_tickets_per_attendee
      FROM events
      WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      FOR UPDATE
    `;
    return rows[0];
  }
  const rows = await tx.$queryRaw<EventRow[]>`
    SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
           timezone, starts_at, ends_at, venue_name, venue_address,
           contact_email, contact_phone, contact_url,
           redemption_opens_at, redemption_closes_at,
           check_in_opens_at, check_in_closes_at,
           revision, max_tickets_per_attendee
    FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
  `;
  return rows[0];
}

async function claimOperation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    command: string;
    clientKey: string;
    requestHash: string;
  },
): Promise<{ op: OperationRow; claimed: boolean }> {
  const operationId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
      ${input.actorUserId}::uuid, ${input.command}, ${input.clientKey},
      ${input.requestHash}, 'IN_PROGRESS', now(), now()
    )
    ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
    DO NOTHING
  `;
  const ops = await tx.$queryRaw<OperationRow[]>`
    SELECT id, request_hash, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${input.command}
      AND client_key = ${input.clientKey}
    FOR UPDATE
  `;
  const op = ops[0];
  if (!op) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to claim idempotency operation',
      true,
    );
  }
  if (op.request_hash !== input.requestHash) {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key was reused with a different request',
    );
  }
  if (op.status === 'COMPLETED') {
    return { op, claimed: false };
  }
  if (op.status === 'FAILED') {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key already finished with a terminal failure; use a new key',
    );
  }
  return { op, claimed: true };
}

async function completeOperation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operationId: string,
  body: unknown,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE operations
    SET status = 'COMPLETED',
        response_json = ${JSON.stringify(body)}::jsonb,
        updated_at = now()
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${operationId}::uuid
  `;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    action: string;
    reason?: string;
    sanitizedDiff?: unknown;
    operationId?: string;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id,
      reason, sanitized_diff, operation_id
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid,
      ${input.action},
      'event',
      ${input.eventId}::uuid,
      ${input.reason ?? null},
      ${input.sanitizedDiff ? JSON.stringify(input.sanitizedDiff) : null}::jsonb,
      ${input.operationId ?? null}::uuid
    )
  `;
}

function normalizeVenue(
  venue: CreateEventBodyV2['venue'],
): { name: string; address: string } | null | undefined {
  if (venue === undefined) return undefined;
  if (venue === null) return null;
  const name = venue.name?.trim() ?? '';
  const address = venue.address?.trim() ?? '';
  if (!name || !address || name.length > MAX_VENUE_NAME || address.length > MAX_VENUE_ADDRESS) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_METADATA,
      'venue requires bounded name and address',
    );
  }
  return { name, address };
}

function normalizeContact(
  contact: CreateEventBodyV2['contact'],
): { email?: string; phone?: string; url?: string } | null | undefined {
  if (contact === undefined) return undefined;
  if (contact === null) return null;
  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  const url = contact.url?.trim();
  if (!email && !phone && !url) return null;
  if (
    (email && email.length > MAX_CONTACT) ||
    (phone && phone.length > MAX_CONTACT) ||
    (url && url.length > MAX_CONTACT)
  ) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_METADATA,
      'contact fields exceed bound',
    );
  }
  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(url ? { url } : {}),
  };
}

function replayDetail(op: OperationRow): EventMutationResult {
  const body = op.response_json as { event?: EventDetail } | null;
  if (!body?.event) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Idempotent operation is still in progress',
      true,
    );
  }
  return { event: body.event, operationId: op.id, replayed: true };
}

export async function getEvent(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; eventId: string; actorUserId: string },
): Promise<EventDetail> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.eventId,
  });
  const row = await selectEvent(tx, input.tenantId, input.eventId);
  if (!row) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  return mapEventDetail(row);
}

export async function listEvents(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    limit?: number;
    cursor?: string | null;
  },
): Promise<{ items: EventDetail[]; nextCursor: string | null }> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
  });
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = input.cursor?.trim() || null;
  const rows = cursor
    ? await tx.$queryRaw<EventRow[]>`
        SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
               timezone, starts_at, ends_at, venue_name, venue_address,
               contact_email, contact_phone, contact_url,
               redemption_opens_at, redemption_closes_at,
               check_in_opens_at, check_in_closes_at,
               revision, max_tickets_per_attendee
        FROM events
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id > ${cursor}::uuid
        ORDER BY id ASC
        LIMIT ${limit + 1}
      `
    : await tx.$queryRaw<EventRow[]>`
        SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
               timezone, starts_at, ends_at, venue_name, venue_address,
               contact_email, contact_phone, contact_url,
               redemption_opens_at, redemption_closes_at,
               check_in_opens_at, check_in_closes_at,
               revision, max_tickets_per_attendee
        FROM events
        WHERE tenant_id = ${input.tenantId}::uuid
        ORDER BY id ASC
        LIMIT ${limit + 1}
      `;
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1]!.id : null;
  return { items: page.map(mapEventDetail), nextCursor };
}

export async function createEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    idempotencyKey: string;
    body: CreateEventBodyV2;
  },
): Promise<EventMutationResult> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
  });
  const policy = await lockTenantPolicyForShare(tx, input.tenantId);
  assertTenantAllowsAdminMutation(policy.status);
  const lim = await tx.$queryRaw<{ max_events: number | null }[]>`
    SELECT max_events FROM tenant_limits
    WHERE tenant_id = ${input.tenantId}::uuid
    FOR UPDATE
  `;
  const maxEvents = lim[0]?.max_events ?? null;
  if (maxEvents !== null) {
    const cnt = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM events WHERE tenant_id = ${input.tenantId}::uuid
    `;
    if ((cnt[0]?.n ?? 0) >= maxEvents) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
        'Event limit reached',
      );
    }
  }

  const slug = assertValidSlug(input.body.slug);
  const name = input.body.name?.trim() ?? '';
  if (!name || name.length > MAX_NAME) {
    throw new EventError(EVENT_ERROR_CODES.INVALID_METADATA, 'Invalid event name');
  }
  const timezone = assertValidTimezone(
    input.body.timezone ?? 'Asia/Ho_Chi_Minh',
  );
  const visibility = assertVisibility(input.body.visibility) ?? 'UNLISTED';
  const startsAt = parseUtcInstant(input.body.startsAt, 'startsAt');
  const endsAt = parseUtcInstant(input.body.endsAt, 'endsAt');
  assertWindowOrder(startsAt ?? null, endsAt ?? null, 'event');
  const redemptionOpensAt = parseUtcInstant(
    input.body.redemptionOpensAt,
    'redemptionOpensAt',
  );
  const redemptionClosesAt = parseUtcInstant(
    input.body.redemptionClosesAt,
    'redemptionClosesAt',
  );
  assertWindowOrder(
    redemptionOpensAt ?? null,
    redemptionClosesAt ?? null,
    'redemption',
  );
  const checkInOpensAt = parseUtcInstant(
    input.body.checkInOpensAt,
    'checkInOpensAt',
  );
  const checkInClosesAt = parseUtcInstant(
    input.body.checkInClosesAt,
    'checkInClosesAt',
  );
  assertWindowOrder(checkInOpensAt ?? null, checkInClosesAt ?? null, 'checkIn');
  const venue = normalizeVenue(input.body.venue) ?? null;
  const contact = normalizeContact(input.body.contact) ?? null;
  let maxTickets: number | null = null;
  if (input.body.maxTicketsPerAttendee !== undefined) {
    maxTickets = input.body.maxTicketsPerAttendee;
    if (maxTickets !== null && (!Number.isInteger(maxTickets) || maxTickets < 1)) {
      throw new EventError(
        EVENT_ERROR_CODES.INVALID_METADATA,
        'maxTicketsPerAttendee must be null or a positive integer',
      );
    }
  }

  const eventId = deterministicEventId([
    input.tenantId,
    input.actorUserId,
    EVENT_CREATE_COMMAND,
    clientKey,
  ]);
  const requestHash = canonicalHash({
    command: EVENT_CREATE_COMMAND,
    tenantId: input.tenantId,
    slug,
    name,
    timezone,
    visibility,
    startsAt: startsAt === undefined ? null : iso(startsAt),
    endsAt: endsAt === undefined ? null : iso(endsAt),
    venue,
    contact,
    redemptionOpensAt:
      redemptionOpensAt === undefined ? null : iso(redemptionOpensAt),
    redemptionClosesAt:
      redemptionClosesAt === undefined ? null : iso(redemptionClosesAt),
    checkInOpensAt: checkInOpensAt === undefined ? null : iso(checkInOpensAt),
    checkInClosesAt:
      checkInClosesAt === undefined ? null : iso(checkInClosesAt),
    maxTicketsPerAttendee: maxTickets,
  });

  const slugTaken = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND slug = ${slug}
  `;
  if (slugTaken[0] && slugTaken[0].id !== eventId) {
    throw new EventError(EVENT_ERROR_CODES.SLUG_TAKEN, 'Event slug already exists');
  }

  // Insert event before operations FK (deterministic id enables replay).
  await tx.$executeRaw`
    INSERT INTO events (
      tenant_id, id, slug, name, status, content_status, business_status,
      revision, visibility, timezone, starts_at, ends_at,
      venue_name, venue_address, contact_email, contact_phone, contact_url,
      redemption_opens_at, redemption_closes_at,
      check_in_opens_at, check_in_closes_at, max_tickets_per_attendee
    ) VALUES (
      ${input.tenantId}::uuid, ${eventId}::uuid, ${slug}, ${name},
      'DRAFT', 'DRAFT', 'ACTIVE', 1, ${visibility}, ${timezone},
      ${startsAt ?? null}, ${endsAt ?? null},
      ${venue?.name ?? null}, ${venue?.address ?? null},
      ${contact?.email ?? null}, ${contact?.phone ?? null}, ${contact?.url ?? null},
      ${redemptionOpensAt ?? null}, ${redemptionClosesAt ?? null},
      ${checkInOpensAt ?? null}, ${checkInClosesAt ?? null},
      ${maxTickets}
    )
    ON CONFLICT (tenant_id, id) DO NOTHING
  `;

  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId,
    actorUserId: input.actorUserId,
    command: EVENT_CREATE_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) return replayDetail(op);

  const membership = await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
  });
  await grantEventAssignment(tx, {
    tenantId: input.tenantId,
    eventId,
    membershipId: membership.membership.membershipId,
    permissions: [PERMISSION_UPDATE, ...CREATOR_EVENT_PERMISSIONS],
  });

  const row = await selectEvent(tx, input.tenantId, eventId);
  if (!row) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Event insert raced; retry',
      true,
    );
  }
  const detail = mapEventDetail(row);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId,
    actorUserId: input.actorUserId,
    action: 'event.created',
    operationId: op.id,
  });
  await completeOperation(tx, input.tenantId, op.id, { event: detail });
  return { event: detail, operationId: op.id, replayed: false };
}

function venueEquals(
  a: { name: string; address: string } | null,
  b: { name: string; address: string } | null,
): boolean {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.address === b.address;
}

export async function previewEventImpact(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    body: EventImpactPreviewRequest;
  },
): Promise<EventImpactPreviewResponse> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.eventId,
  });
  const row = await selectEvent(tx, input.tenantId, input.eventId, true);
  if (!row) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (row.revision !== input.body.expectedRevision) {
    throw new EventError(
      EVENT_ERROR_CODES.REVISION_CONFLICT,
      'Event revision conflict',
    );
  }
  const startsAt =
    input.body.startsAt !== undefined
      ? parseUtcInstant(input.body.startsAt, 'startsAt')
      : row.starts_at;
  const endsAt =
    input.body.endsAt !== undefined
      ? parseUtcInstant(input.body.endsAt, 'endsAt')
      : row.ends_at;
  assertWindowOrder(startsAt ?? null, endsAt ?? null, 'event');
  const venue =
    input.body.venue !== undefined
      ? normalizeVenue(input.body.venue) ?? null
      : row.venue_name && row.venue_address
        ? { name: row.venue_name, address: row.venue_address }
        : null;

  const diff: EventImpactPreviewResponse['diff'] = [];
  if (
    input.body.startsAt !== undefined &&
    iso(startsAt ?? null) !== iso(row.starts_at)
  ) {
    diff.push({
      field: 'startsAt',
      from: iso(row.starts_at),
      to: iso(startsAt ?? null),
    });
  }
  if (
    input.body.endsAt !== undefined &&
    iso(endsAt ?? null) !== iso(row.ends_at)
  ) {
    diff.push({
      field: 'endsAt',
      from: iso(row.ends_at),
      to: iso(endsAt ?? null),
    });
  }
  if (input.body.venue !== undefined) {
    const current =
      row.venue_name && row.venue_address
        ? { name: row.venue_name, address: row.venue_address }
        : null;
    if (!venueEquals(current, venue)) {
      diff.push({
        field: 'venue',
        from: current ? `${current.name}|${current.address}` : null,
        to: venue ? `${venue.name}|${venue.address}` : null,
      });
    }
  }

  const counts = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM tickets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
  `;
  const affectedTicketCount = Number(counts[0]?.count ?? 0);
  const impactFields = diff.some((d) =>
    d.field === 'startsAt' || d.field === 'endsAt' || d.field === 'venue',
  );
  return {
    revision: row.revision,
    affectedTicketCount,
    requiresConfirm: impactFields && affectedTicketCount > 0,
    diff,
  };
}

export async function updateEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    idempotencyKey: string;
    body: PatchEventBody;
  },
): Promise<EventMutationResult> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.eventId,
  });

  const requestHash = canonicalHash({
    command: EVENT_UPDATE_COMMAND,
    tenantId: input.tenantId,
    eventId: input.eventId,
    body: input.body,
  });
  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    command: EVENT_UPDATE_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) return replayDetail(op);

  const row = await selectEvent(tx, input.tenantId, input.eventId, true);
  if (!row) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (row.business_status === 'CANCELLED') {
    throw new EventError(
      EVENT_ERROR_CODES.EVENT_CANCELLED,
      'Cancelled event cannot be updated',
    );
  }
  if (row.revision !== input.body.expectedRevision) {
    throw new EventError(
      EVENT_ERROR_CODES.REVISION_CONFLICT,
      'Event revision conflict',
    );
  }

  const name =
    input.body.name !== undefined ? input.body.name.trim() : row.name;
  if (!name || name.length > MAX_NAME) {
    throw new EventError(EVENT_ERROR_CODES.INVALID_METADATA, 'Invalid event name');
  }
  const timezone =
    input.body.timezone !== undefined
      ? assertValidTimezone(input.body.timezone)
      : row.timezone;
  const visibility =
    input.body.visibility !== undefined
      ? assertVisibility(input.body.visibility)!
      : row.visibility;
  const startsAt =
    input.body.startsAt !== undefined
      ? parseUtcInstant(input.body.startsAt, 'startsAt')
      : row.starts_at;
  const endsAt =
    input.body.endsAt !== undefined
      ? parseUtcInstant(input.body.endsAt, 'endsAt')
      : row.ends_at;
  assertWindowOrder(startsAt ?? null, endsAt ?? null, 'event');
  const redemptionOpensAt =
    input.body.redemptionOpensAt !== undefined
      ? parseUtcInstant(input.body.redemptionOpensAt, 'redemptionOpensAt')
      : row.redemption_opens_at;
  const redemptionClosesAt =
    input.body.redemptionClosesAt !== undefined
      ? parseUtcInstant(input.body.redemptionClosesAt, 'redemptionClosesAt')
      : row.redemption_closes_at;
  assertWindowOrder(
    redemptionOpensAt ?? null,
    redemptionClosesAt ?? null,
    'redemption',
  );
  const checkInOpensAt =
    input.body.checkInOpensAt !== undefined
      ? parseUtcInstant(input.body.checkInOpensAt, 'checkInOpensAt')
      : row.check_in_opens_at;
  const checkInClosesAt =
    input.body.checkInClosesAt !== undefined
      ? parseUtcInstant(input.body.checkInClosesAt, 'checkInClosesAt')
      : row.check_in_closes_at;
  assertWindowOrder(checkInOpensAt ?? null, checkInClosesAt ?? null, 'checkIn');
  const venue =
    input.body.venue !== undefined
      ? normalizeVenue(input.body.venue) ?? null
      : row.venue_name && row.venue_address
        ? { name: row.venue_name, address: row.venue_address }
        : null;
  const contact =
    input.body.contact !== undefined
      ? normalizeContact(input.body.contact) ?? null
      : row.contact_email || row.contact_phone || row.contact_url
        ? {
            ...(row.contact_email ? { email: row.contact_email } : {}),
            ...(row.contact_phone ? { phone: row.contact_phone } : {}),
            ...(row.contact_url ? { url: row.contact_url } : {}),
          }
        : null;
  let maxTickets = row.max_tickets_per_attendee;
  if (input.body.maxTicketsPerAttendee !== undefined) {
    maxTickets = input.body.maxTicketsPerAttendee;
    if (maxTickets !== null && (!Number.isInteger(maxTickets) || maxTickets < 1)) {
      throw new EventError(
        EVENT_ERROR_CODES.INVALID_METADATA,
        'maxTicketsPerAttendee must be null or a positive integer',
      );
    }
  }

  const impactPreview = await previewEventImpact(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    body: {
      expectedRevision: input.body.expectedRevision,
      startsAt: input.body.startsAt,
      endsAt: input.body.endsAt,
      venue: input.body.venue,
    },
  });
  if (impactPreview.requiresConfirm && input.body.confirmIssuedImpact !== true) {
    throw new EventError(
      EVENT_ERROR_CODES.IMPACT_CONFIRM_REQUIRED,
      'confirmIssuedImpact is required when issued tickets are affected',
    );
  }

  const nextRevision = row.revision + 1;
  await tx.$executeRaw`
    UPDATE events
    SET name = ${name},
        timezone = ${timezone},
        visibility = ${visibility},
        starts_at = ${startsAt ?? null},
        ends_at = ${endsAt ?? null},
        venue_name = ${venue?.name ?? null},
        venue_address = ${venue?.address ?? null},
        contact_email = ${contact?.email ?? null},
        contact_phone = ${contact?.phone ?? null},
        contact_url = ${contact?.url ?? null},
        redemption_opens_at = ${redemptionOpensAt ?? null},
        redemption_closes_at = ${redemptionClosesAt ?? null},
        check_in_opens_at = ${checkInOpensAt ?? null},
        check_in_closes_at = ${checkInClosesAt ?? null},
        max_tickets_per_attendee = ${maxTickets},
        revision = ${nextRevision}
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
      AND revision = ${input.body.expectedRevision}
  `;

  const updated = await selectEvent(tx, input.tenantId, input.eventId);
  if (!updated || updated.revision !== nextRevision) {
    throw new EventError(
      EVENT_ERROR_CODES.REVISION_CONFLICT,
      'Event revision conflict',
    );
  }
  const detail = mapEventDetail(updated);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'event.updated',
    sanitizedDiff: impactPreview.diff,
    operationId: op.id,
  });

  // Notify intent only when a handler exists (N2). Never enqueue unsupported kinds.
  if (
    input.body.notifyAttendees === true &&
    canEnqueueOutboxKind('EventChanged')
  ) {
    // Reserved for N2 EventChanged handler.
  }

  await completeOperation(tx, input.tenantId, op.id, { event: detail });
  return { event: detail, operationId: op.id, replayed: false };
}

export async function cloneEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    sourceEventId: string;
    actorUserId: string;
    idempotencyKey: string;
    body: CloneEventBody;
  },
): Promise<EventMutationResult> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.sourceEventId,
  });

  const slug = assertValidSlug(input.body.slug);
  const name = input.body.name?.trim() ?? '';
  if (!name || name.length > MAX_NAME) {
    throw new EventError(EVENT_ERROR_CODES.INVALID_METADATA, 'Invalid event name');
  }
  const copyConfig = input.body.copyConfig === true;
  const newEventId = deterministicEventId([
    input.tenantId,
    input.actorUserId,
    EVENT_CLONE_COMMAND,
    clientKey,
    input.sourceEventId,
  ]);
  const requestHash = canonicalHash({
    command: EVENT_CLONE_COMMAND,
    tenantId: input.tenantId,
    sourceEventId: input.sourceEventId,
    slug,
    name,
    copyConfig,
  });
  const source = await selectEvent(tx, input.tenantId, input.sourceEventId, true);
  if (!source) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Source event not found');
  }

  const slugTaken = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND slug = ${slug}
  `;
  if (slugTaken[0] && slugTaken[0].id !== newEventId) {
    throw new EventError(EVENT_ERROR_CODES.SLUG_TAKEN, 'Event slug already exists');
  }

  await tx.$executeRaw`
    INSERT INTO events (
      tenant_id, id, slug, name, status, content_status, business_status,
      revision, visibility, timezone, starts_at, ends_at,
      venue_name, venue_address, contact_email, contact_phone, contact_url,
      redemption_opens_at, redemption_closes_at,
      check_in_opens_at, check_in_closes_at, max_tickets_per_attendee
    ) VALUES (
      ${input.tenantId}::uuid, ${newEventId}::uuid, ${slug}, ${name},
      'DRAFT', 'DRAFT', 'ACTIVE', 1, ${source.visibility}, ${source.timezone},
      ${source.starts_at}, ${source.ends_at},
      ${source.venue_name}, ${source.venue_address},
      ${source.contact_email}, ${source.contact_phone}, ${source.contact_url},
      ${source.redemption_opens_at}, ${source.redemption_closes_at},
      ${source.check_in_opens_at}, ${source.check_in_closes_at},
      ${source.max_tickets_per_attendee}
    )
    ON CONFLICT (tenant_id, id) DO NOTHING
  `;

  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId: newEventId,
    actorUserId: input.actorUserId,
    command: EVENT_CLONE_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) return replayDetail(op);

  if (copyConfig) {
    await tx.$executeRaw`
      INSERT INTO event_config_versions (
        tenant_id, event_id, version, schema_version, payload, author_user_id, created_at
      )
      SELECT
        ${input.tenantId}::uuid,
        ${newEventId}::uuid,
        version,
        schema_version,
        payload,
        ${input.actorUserId}::uuid,
        now()
      FROM event_config_versions
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.sourceEventId}::uuid
      ORDER BY version ASC
    `;
  }

  const membership = await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.sourceEventId,
  });
  await grantEventAssignment(tx, {
    tenantId: input.tenantId,
    eventId: newEventId,
    membershipId: membership.membership.membershipId,
    permissions: [PERMISSION_UPDATE, ...CREATOR_EVENT_PERMISSIONS],
  });

  // Explicit zero-copy guard: no staff sessions / codes / attendees / tickets / quotas.
  const leaked = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT (
      (SELECT COUNT(*) FROM redemption_codes WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${newEventId}::uuid)
      + (SELECT COUNT(*) FROM tickets WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${newEventId}::uuid)
      + (SELECT COUNT(*) FROM event_attendees WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${newEventId}::uuid)
      + (SELECT COUNT(*) FROM quota_buckets WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${newEventId}::uuid)
      + (SELECT COUNT(*) FROM staff_sessions WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${newEventId}::uuid)
      + (SELECT COUNT(*) FROM event_assignments ea
         WHERE ea.tenant_id = ${input.tenantId}::uuid AND ea.event_id = ${newEventId}::uuid
           AND ea.membership_id <> ${membership.membership.membershipId}::uuid)
    )::bigint AS n
  `;
  if (Number(leaked[0]?.n ?? 0) !== 0) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Clone produced unexpected business rows',
      true,
    );
  }

  const row = await selectEvent(tx, input.tenantId, newEventId);
  if (!row) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Clone insert failed',
      true,
    );
  }
  const detail = mapEventDetail(row);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: newEventId,
    actorUserId: input.actorUserId,
    action: 'event.cloned',
    sanitizedDiff: { sourceEventId: input.sourceEventId, copyConfig },
    operationId: op.id,
  });
  await completeOperation(tx, input.tenantId, op.id, { event: detail });
  return { event: detail, operationId: op.id, replayed: false };
}

export async function archiveEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    idempotencyKey: string;
    body: { expectedRevision: number };
  },
): Promise<EventMutationResult> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.eventId,
  });
  const requestHash = canonicalHash({
    command: EVENT_ARCHIVE_COMMAND,
    tenantId: input.tenantId,
    eventId: input.eventId,
    expectedRevision: input.body.expectedRevision,
  });
  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    command: EVENT_ARCHIVE_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) return replayDetail(op);

  const row = await selectEvent(tx, input.tenantId, input.eventId, true);
  if (!row) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (row.revision !== input.body.expectedRevision) {
    throw new EventError(
      EVENT_ERROR_CODES.REVISION_CONFLICT,
      'Event revision conflict',
    );
  }
  if (row.content_status === 'ARCHIVED') {
    const detail = mapEventDetail(row);
    await completeOperation(tx, input.tenantId, op.id, { event: detail });
    return { event: detail, operationId: op.id, replayed: false };
  }
  const nextRevision = row.revision + 1;
  await tx.$executeRaw`
    UPDATE events
    SET content_status = 'ARCHIVED',
        status = 'ARCHIVED',
        revision = ${nextRevision}
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
      AND revision = ${input.body.expectedRevision}
  `;
  const updated = await selectEvent(tx, input.tenantId, input.eventId);
  if (!updated) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  const detail = mapEventDetail(updated);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'event.archived',
    operationId: op.id,
  });
  await completeOperation(tx, input.tenantId, op.id, { event: detail });
  return { event: detail, operationId: op.id, replayed: false };
}

export async function cancelEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    idempotencyKey: string;
    body: CancelEventBody;
  },
): Promise<EventMutationResult> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UPDATE,
    eventId: input.eventId,
  });
  const reason = input.body.reason?.trim() ?? '';
  if (!reason || reason.length > MAX_CANCEL_REASON) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_METADATA,
      'cancel reason is required (max 500)',
    );
  }
  const requestHash = canonicalHash({
    command: EVENT_CANCEL_COMMAND,
    tenantId: input.tenantId,
    eventId: input.eventId,
    expectedRevision: input.body.expectedRevision,
    reason,
    notifyAttendees: input.body.notifyAttendees === true,
  });
  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    command: EVENT_CANCEL_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) return replayDetail(op);

  const row = await selectEvent(tx, input.tenantId, input.eventId, true);
  if (!row) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (row.revision !== input.body.expectedRevision) {
    throw new EventError(
      EVENT_ERROR_CODES.REVISION_CONFLICT,
      'Event revision conflict',
    );
  }
  if (row.business_status === 'CANCELLED') {
    const detail = mapEventDetail(row);
    await completeOperation(tx, input.tenantId, op.id, { event: detail });
    return { event: detail, operationId: op.id, replayed: false };
  }

  const now = await dbClock(tx);
  const nextRevision = row.revision + 1;
  await tx.$executeRaw`
    UPDATE events
    SET business_status = 'CANCELLED',
        cancel_reason = ${reason},
        cancelled_at = ${now},
        revision = ${nextRevision}
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
      AND revision = ${input.body.expectedRevision}
  `;
  const updated = await selectEvent(tx, input.tenantId, input.eventId);
  if (!updated) {
    throw new EventError(EVENT_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  const detail = mapEventDetail(updated);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'event.cancelled',
    reason,
    operationId: op.id,
  });

  // Cancel notification intent deferred until EventCancelled handler exists (N2).
  if (
    input.body.notifyAttendees !== false &&
    canEnqueueOutboxKind('EventCancelled')
  ) {
    // Reserved for N2.
  }

  await completeOperation(tx, input.tenantId, op.id, { event: detail });
  return { event: detail, operationId: op.id, replayed: false };
}

// Re-export Archive body type alias for API layer convenience.
export type { ArchiveEventBody } from '@ticket/contracts';

/** Opaque id-only cursor — avoids timestamptz ms truncation skew. */
type CatalogCursor = { id: string };

function encodeCatalogCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

function decodeCatalogCursor(cursor: string | undefined): CatalogCursor | null {
  if (cursor === undefined || cursor === null) return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  try {
    const raw = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (typeof parsed.id !== 'string' || !UUID_RE.test(parsed.id)) {
      return null;
    }
    return { id: parsed.id };
  } catch {
    return null;
  }
}

function requireCatalogCursor(cursor: string | undefined): CatalogCursor | null {
  if (cursor === undefined || cursor === null || cursor.trim() === '') {
    return null;
  }
  const decoded = decodeCatalogCursor(cursor);
  if (!decoded) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.INVALID_CURSOR,
      'Invalid cursor',
    );
  }
  return decoded;
}

function clampCatalogLimit(limit?: number): number {
  const n =
    typeof limit === 'number' && Number.isFinite(limit)
      ? limit
      : CURSOR_PAGE_LIMIT.default;
  return Math.min(
    Math.max(n, CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
}

/** Controlled JSON object only — never arrays, primitives, or non-JSON values. */
function controlledEntitlementSnapshot(
  value: unknown,
): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  let candidate: unknown = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return {};
    }
  }
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(candidate));
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function assertEventExistsForCatalog(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<void> {
  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
  `;
  if (!events[0]) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }
}

/**
 * Event-scoped ticket-type catalog (G-T1). Requires event.config + assignment.
 */
export async function listTicketTypes(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
  },
): Promise<PortalTicketTypesPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  await assertEventExistsForCatalog(tx, input.tenantId, input.eventId);

  const limit = clampCatalogLimit(input.limit);
  const cursor = requireCatalogCursor(input.cursor);

  type TicketTypeRow = {
    id: string;
    label: string;
    entitlement_snapshot: unknown;
  };

  const rows = cursor
    ? await tx.$queryRaw<TicketTypeRow[]>`
        SELECT id, label, entitlement_snapshot
        FROM ticket_types
        WHERE tenant_id = ${input.tenantId}::uuid
          AND event_id = ${input.eventId}::uuid
          AND id > ${cursor.id}::uuid
        ORDER BY id ASC
        LIMIT ${limit + 1}
      `
    : await tx.$queryRaw<TicketTypeRow[]>`
        SELECT id, label, entitlement_snapshot
        FROM ticket_types
        WHERE tenant_id = ${input.tenantId}::uuid
          AND event_id = ${input.eventId}::uuid
        ORDER BY id ASC
        LIMIT ${limit + 1}
      `;

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      ticketTypeId: row.id,
      label: row.label,
      entitlementSnapshot: controlledEntitlementSnapshot(
        row.entitlement_snapshot,
      ),
    })),
    nextCursor:
      rows.length > limit && last ? encodeCatalogCursor(last.id) : null,
  };
}

/**
 * Event-scoped issuance-source catalog (G-T1). ticketTypeIds includes all mappings.
 */
export async function listIssuanceSources(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
  },
): Promise<PortalSourcesPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  await assertEventExistsForCatalog(tx, input.tenantId, input.eventId);

  const limit = clampCatalogLimit(input.limit);
  const cursor = requireCatalogCursor(input.cursor);

  type SourceRow = {
    id: string;
    name: string;
    approval_mode: string;
    ticket_type_ids: string[] | null;
  };

  const rows = cursor
    ? await tx.$queryRaw<SourceRow[]>`
        SELECT s.id, s.name, s.approval_mode,
               COALESCE(
                 (
                   SELECT array_agg(stt.ticket_type_id::text ORDER BY stt.ticket_type_id)
                   FROM source_ticket_types stt
                   WHERE stt.tenant_id = s.tenant_id
                     AND stt.event_id = s.event_id
                     AND stt.source_id = s.id
                 ),
                 '{}'::text[]
               ) AS ticket_type_ids
        FROM issuance_sources s
        WHERE s.tenant_id = ${input.tenantId}::uuid
          AND s.event_id = ${input.eventId}::uuid
          AND s.id > ${cursor.id}::uuid
        ORDER BY s.id ASC
        LIMIT ${limit + 1}
      `
    : await tx.$queryRaw<SourceRow[]>`
        SELECT s.id, s.name, s.approval_mode,
               COALESCE(
                 (
                   SELECT array_agg(stt.ticket_type_id::text ORDER BY stt.ticket_type_id)
                   FROM source_ticket_types stt
                   WHERE stt.tenant_id = s.tenant_id
                     AND stt.event_id = s.event_id
                     AND stt.source_id = s.id
                 ),
                 '{}'::text[]
               ) AS ticket_type_ids
        FROM issuance_sources s
        WHERE s.tenant_id = ${input.tenantId}::uuid
          AND s.event_id = ${input.eventId}::uuid
        ORDER BY s.id ASC
        LIMIT ${limit + 1}
      `;

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      sourceId: row.id,
      name: row.name,
      approvalMode: row.approval_mode as 'AUTO' | 'MANUAL',
      ticketTypeIds: Array.isArray(row.ticket_type_ids)
        ? row.ticket_type_ids
        : [],
    })),
    nextCursor:
      rows.length > limit && last ? encodeCatalogCursor(last.id) : null,
  };
}

export async function createTicketType(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    label: string;
    entitlementSnapshot?: Record<string, unknown>;
  },
): Promise<{ ticketTypeId: string; label: string }> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }
  const label = input.label.trim();
  if (!label || label.length > 120) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.INVALID_SLUG,
      'Invalid label',
    );
  }
  const ticketTypeId = randomUUID();
  const snapshot = JSON.stringify(input.entitlementSnapshot ?? {});
  await tx.$executeRaw`
    INSERT INTO ticket_types (
      tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${ticketTypeId}::uuid,
      ${label}, ${snapshot}::jsonb, now(), now()
    )
  `;
  return { ticketTypeId, label };
}

export async function createIssuanceSource(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    name: string;
    approvalMode: string;
    ticketTypeId: string;
  },
): Promise<{
  sourceId: string;
  name: string;
  approvalMode: 'AUTO' | 'MANUAL';
  ticketTypeId: string;
}> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  if (!APPROVAL_MODES.has(input.approvalMode)) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.INVALID_APPROVAL_MODE,
      'approvalMode must be AUTO or MANUAL',
    );
  }
  const types = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ticket_types
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.ticketTypeId}::uuid
  `;
  if (!types[0]) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.TICKET_TYPE_NOT_FOUND,
      'Ticket type not found',
    );
  }
  const name = input.name.trim();
  if (!name || name.length > 120) {
    throw new EventAdminError(
      EVENT_ADMIN_ERROR_CODES.INVALID_SLUG,
      'Invalid source name',
    );
  }
  const sourceId = randomUUID();
  const mode = input.approvalMode as 'AUTO' | 'MANUAL';
  await tx.$executeRaw`
    INSERT INTO issuance_sources (
      tenant_id, event_id, id, name, approval_mode, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${sourceId}::uuid,
      ${name}, ${mode}, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO source_ticket_types (
      tenant_id, event_id, source_id, ticket_type_id
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid,
      ${sourceId}::uuid, ${input.ticketTypeId}::uuid
    )
  `;
  return {
    sourceId,
    name,
    approvalMode: mode,
    ticketTypeId: input.ticketTypeId,
  };
}
