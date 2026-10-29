import type { Prisma } from './generated/prisma/client';
import {
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
} from '@ticket/contracts';
import { EventError, EVENT_ERROR_CODES } from './event-error';
import { canEnqueueOutboxKind, dbClock } from './event-policy';
import {
  canonicalHash,
  claimOperation,
  completeOperation,
  requireIdempotencyKey,
  writeAudit,
  type OperationRow,
} from './event-operations';
import {
  deterministicEventId,
  iso,
  mapEventDetail,
  selectEvent,
  type EventRow,
} from './event-row';
import {
  assertTenantAllowsAdminMutationForShare,
  assertTenantEventCountWithinLimit,
} from './event-tenant-guards';
import {
  assertValidSlug,
  assertValidTimezone,
  assertVisibility,
  assertWindowOrder,
  MAX_CANCEL_REASON,
  MAX_EVENT_NAME,
  normalizeContact,
  normalizeVenue,
  parseUtcInstant,
  venueEquals,
} from './event-validation';
import {
  grantEventAssignment,
  requireEventAssignment,
  requireTenantPermission,
} from './membership';

const PERMISSION_CREATE = 'event.create';
const PERMISSION_UPDATE = 'event.update';

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

export type EventMutationResult = {
  event: EventDetail;
  operationId: string;
  replayed: boolean;
};

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
  await requireEventAssignment(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
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
  const slug = assertValidSlug(input.body.slug);
  const name = input.body.name?.trim() ?? '';
  if (!name || name.length > MAX_EVENT_NAME) {
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

  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);
  await assertTenantEventCountWithinLimit(tx, input.tenantId);

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
  if ((endsAt?.getTime() ?? null) !== (row.ends_at?.getTime() ?? null)) {
    const fences = await tx.$queryRaw<{
      ticket_pii_anonymized_at: Date | null;
      export_retention_fenced_at: Date | null;
    }[]>`
      SELECT ticket_pii_anonymized_at, export_retention_fenced_at FROM events
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
    `;
    if (fences[0]?.ticket_pii_anonymized_at || fences[0]?.export_retention_fenced_at) {
      throw new EventError(
        EVENT_ERROR_CODES.EVENT_RETENTION_FENCED,
        'Event retention clock is fixed after data removal',
      );
    }
  }
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

  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);

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
  if (!name || name.length > MAX_EVENT_NAME) {
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
  if (!name || name.length > MAX_EVENT_NAME) {
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

  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);
  await assertTenantEventCountWithinLimit(tx, input.tenantId);

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

  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);

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

  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);

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

  const fences = await tx.$queryRaw<{ ticket_pii_anonymized_at: Date | null }[]>`
    SELECT ticket_pii_anonymized_at FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  if (fences[0]?.ticket_pii_anonymized_at) {
    throw new EventError(
      EVENT_ERROR_CODES.EVENT_RETENTION_FENCED,
      'Event retention clock is fixed after data removal',
    );
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
