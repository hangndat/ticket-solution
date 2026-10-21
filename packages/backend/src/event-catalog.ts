import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  CURSOR_PAGE_LIMIT,
  type PortalSourcesPage,
  type PortalTicketTypesPage,
} from '@ticket/contracts';
import {
  EventAdminError,
  EVENT_ADMIN_ERROR_CODES,
} from './event-admin-error';
import { assertTenantAllowsAdminMutationForShare } from './event-tenant-guards';
import { EVENT_UUID_RE } from './event-validation';
import { requireTenantPermission } from './membership';

const PERMISSION_CONFIG = 'event.config';
const APPROVAL_MODES = new Set(['AUTO', 'MANUAL']);

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
    if (typeof parsed.id !== 'string' || !EVENT_UUID_RE.test(parsed.id)) {
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
  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);
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
  await assertTenantAllowsAdminMutationForShare(tx, input.tenantId);
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
