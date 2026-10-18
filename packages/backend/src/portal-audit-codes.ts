/**
 * H-A1 / H-C1 / H-P-AUDIT — portal audit GET + codes browse (ADR-20 §7.1).
 * Allowlisted projections only; O06 audit TTL 730d; no raw/HMAC/diff leak.
 */
import {
  CURSOR_PAGE_LIMIT,
  type PortalAuditEntry,
  type PortalAuditPage,
  type PortalCodeState,
  type PortalCodeSummary,
  type PortalCodesPage,
  type PortalPlatformAuditEntry,
  type PortalPlatformAuditPage,
} from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';
import { InventoryError, INVENTORY_ERROR_CODES } from './inventory-error';
import { requireTenantPermission } from './membership';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { requireActivePlatformOperator } from './platform-operator';
import { withPlatformRole } from './platform-context';
import { ReportError, REPORT_ERROR_CODES } from './report-error';
import { O06_AUDIT_TTL_DAYS } from './retention-o06';
import { withTenant } from './tenant-context';

const PERMISSION_REPORT = 'report.read';
const PERMISSION_IMPORT = 'inventory.import';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_STATES = new Set<PortalCodeState>([
  'AVAILABLE',
  'HELD',
  'CONSUMED',
]);

type IdCursor = { id: string };

function encodeIdCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

function decodeIdCursor(
  cursor: string | undefined,
  onInvalid: () => never,
): IdCursor | null {
  if (cursor === undefined || cursor === null) return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  try {
    const raw = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (typeof parsed.id !== 'string' || !UUID_RE.test(parsed.id)) {
      onInvalid();
    }
    return { id: parsed.id };
  } catch {
    onInvalid();
  }
}

function clampLimit(limit?: number): number {
  const n =
    typeof limit === 'number' && Number.isFinite(limit)
      ? limit
      : CURSOR_PAGE_LIMIT.default;
  return Math.min(
    Math.max(Math.floor(n), CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
}

function parseOptionalInstant(
  value: string | undefined,
  field: string,
  onInvalid: (message: string) => never,
): Date | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    onInvalid(`${field} must include timezone offset or Z`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    onInvalid(`${field} is not a valid instant`);
  }
  return date;
}

function assertAllowlistedAudit(
  item: Record<string, unknown>,
  forbidden: string[],
): void {
  for (const key of forbidden) {
    if (key in item) {
      throw new ReportError(
        REPORT_ERROR_CODES.EVENT_NOT_FOUND,
        'Audit projection failed privacy check',
      );
    }
  }
}

const AUDIT_FORBIDDEN = [
  'reason',
  'reasonCode',
  'sanitizedDiff',
  'sanitized_diff',
  'code_hmac',
  'codeHmac',
  'rawCode',
  'email',
  'phone',
  'token',
];

const CODE_FORBIDDEN = [
  'code_hmac',
  'codeHmac',
  'rawCode',
  'code',
  'pepper',
  'codePepperVersion',
  'q',
];

/**
 * Event staff audit browser. Requires report.read + assignment.
 * Rows older than O06_AUDIT_TTL_DAYS are excluded.
 */
export async function listEventAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
    from?: string;
    to?: string;
    action?: string;
  },
): Promise<PortalAuditPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_REPORT,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new ReportError(
      REPORT_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }

  const invalidCursor = (): never => {
    throw new ReportError(
      REPORT_ERROR_CODES.INVALID_CURSOR,
      'Invalid cursor',
    );
  };
  const invalidInput = (message: string): never => {
    throw new ReportError(REPORT_ERROR_CODES.INVALID_INPUT, message);
  };

  const limit = clampLimit(input.limit);
  const cursorId = decodeIdCursor(input.cursor, invalidCursor)?.id ?? null;
  const fromAt = parseOptionalInstant(input.from, 'from', invalidInput);
  const toAt = parseOptionalInstant(input.to, 'to', invalidInput);
  if (fromAt && toAt && !(toAt >= fromAt)) {
    invalidInput('to must be greater than or equal to from');
  }
  const actionFilter = input.action?.trim() || null;
  if (actionFilter && actionFilter.length > 200) {
    invalidInput('action exceeds bound');
  }

  type Row = {
    id: string;
    actor_user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    operation_id: string | null;
    created_at: Date;
  };

  const rows = await tx.$queryRaw<Row[]>`
    SELECT id, actor_user_id, action, resource_type, resource_id,
           operation_id, created_at
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND created_at >= (clock_timestamp() - make_interval(days => ${O06_AUDIT_TTL_DAYS}))
      AND (${fromAt}::timestamptz IS NULL OR created_at >= ${fromAt})
      AND (${toAt}::timestamptz IS NULL OR created_at <= ${toAt})
      AND (${actionFilter}::text IS NULL OR action = ${actionFilter})
      AND (
        ${cursorId}::uuid IS NULL
        OR (created_at, id) < (
          SELECT created_at, id FROM audit_logs
          WHERE tenant_id = ${input.tenantId}::uuid
            AND id = ${cursorId}::uuid
        )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 1}
  `;

  const page = rows.slice(0, limit);
  const items: PortalAuditEntry[] = page.map((row) => {
    const item: PortalAuditEntry = {
      auditId: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      operationId: row.operation_id,
      createdAt: row.created_at.toISOString(),
    };
    assertAllowlistedAudit(
      item as unknown as Record<string, unknown>,
      AUDIT_FORBIDDEN,
    );
    return item;
  });

  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last ? encodeIdCursor(last.id) : null,
  };
}

/**
 * Codes inventory browse (masked). Requires inventory.import + assignment.
 * `q` is hashed server-side; never echoed. No HMAC/raw in response.
 */
export async function listEventCodes(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
    state?: PortalCodeState;
    sourceId?: string;
    ticketTypeId?: string;
    q?: string;
  },
): Promise<PortalCodesPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_IMPORT,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new InventoryError(
      INVENTORY_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }

  const invalidCursor = (): never => {
    throw new InventoryError(
      INVENTORY_ERROR_CODES.INVALID_CURSOR,
      'Invalid cursor',
    );
  };
  const invalidInput = (message: string): never => {
    throw new InventoryError(INVENTORY_ERROR_CODES.INVALID_INPUT, message);
  };

  const limit = clampLimit(input.limit);
  const cursorId = decodeIdCursor(input.cursor, invalidCursor)?.id ?? null;

  let stateFilter: PortalCodeState | null = null;
  if (input.state !== undefined && input.state !== null) {
    if (!CODE_STATES.has(input.state)) {
      invalidInput('state must be AVAILABLE, HELD, or CONSUMED');
    }
    stateFilter = input.state;
  }

  const sourceId = input.sourceId?.trim() || null;
  if (sourceId && !UUID_RE.test(sourceId)) {
    invalidInput('sourceId must be a UUID');
  }
  const ticketTypeId = input.ticketTypeId?.trim() || null;
  if (ticketTypeId && !UUID_RE.test(ticketTypeId)) {
    invalidInput('ticketTypeId must be a UUID');
  }

  const qRaw = input.q?.trim() || '';
  const codeHmacFilter =
    qRaw.length > 0 ? hashRedemptionCode(hmac, qRaw) : null;

  type Row = {
    id: string;
    status: string;
    source_id: string;
    ticket_type_id: string;
  };

  const rows = await tx.$queryRaw<Row[]>`
    SELECT id, status, source_id, ticket_type_id
    FROM redemption_codes
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND (${stateFilter}::text IS NULL OR status = ${stateFilter})
      AND (${sourceId}::uuid IS NULL OR source_id = ${sourceId}::uuid)
      AND (${ticketTypeId}::uuid IS NULL OR ticket_type_id = ${ticketTypeId}::uuid)
      AND (${codeHmacFilter}::text IS NULL OR code_hmac = ${codeHmacFilter})
      AND (
        ${cursorId}::uuid IS NULL
        OR id > ${cursorId}::uuid
      )
    ORDER BY id ASC
    LIMIT ${limit + 1}
  `;

  const page = rows.slice(0, limit);
  const items: PortalCodeSummary[] = page.map((row) => {
    const state = row.status as PortalCodeState;
    if (!CODE_STATES.has(state)) {
      throw new InventoryError(
        INVENTORY_ERROR_CODES.INVALID_INPUT,
        'Unexpected code state',
      );
    }
    const item: PortalCodeSummary = {
      codeId: row.id,
      state,
      sourceId: row.source_id,
      ticketTypeId: row.ticket_type_id,
    };
    const rec = item as unknown as Record<string, unknown>;
    for (const key of CODE_FORBIDDEN) {
      if (key in rec) {
        throw new InventoryError(
          INVENTORY_ERROR_CODES.EVENT_NOT_FOUND,
          'Code list failed privacy check',
        );
      }
    }
    return item;
  });

  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last ? encodeIdCursor(last.id) : null,
  };
}

/**
 * Platform operator audit browser (MFA audience). O06 TTL enforced.
 */
export async function listPlatformAudit(
  db: PrismaClient,
  input: {
    actorUserId: string;
    cursor?: string;
    limit?: number;
    from?: string;
    to?: string;
    action?: string;
    tenantId?: string;
  },
): Promise<PortalPlatformAuditPage> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);

    const invalidCursor = (): never => {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVALID_INPUT,
        'Invalid cursor',
      );
    };
    const invalidInput = (message: string): never => {
      throw new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, message);
    };

    const limit = clampLimit(input.limit);
    const cursorId = decodeIdCursor(input.cursor, invalidCursor)?.id ?? null;
    const fromAt = parseOptionalInstant(input.from, 'from', invalidInput);
    const toAt = parseOptionalInstant(input.to, 'to', invalidInput);
    if (fromAt && toAt && !(toAt >= fromAt)) {
      invalidInput('to must be greater than or equal to from');
    }
    const actionFilter = input.action?.trim() || null;
    if (actionFilter && actionFilter.length > 200) {
      invalidInput('action exceeds bound');
    }
    const tenantFilter = input.tenantId?.trim() || null;
    if (tenantFilter && !UUID_RE.test(tenantFilter)) {
      invalidInput('tenantId must be a UUID');
    }

    type Row = {
      id: string;
      actor_user_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      tenant_id: string | null;
      created_at: Date;
    };

    const rows = await tx.$queryRaw<Row[]>`
      SELECT id, actor_user_id, action, resource_type, resource_id,
             tenant_id, created_at
      FROM platform_audit_logs
      WHERE created_at >= (clock_timestamp() - make_interval(days => ${O06_AUDIT_TTL_DAYS}))
        AND (${fromAt}::timestamptz IS NULL OR created_at >= ${fromAt})
        AND (${toAt}::timestamptz IS NULL OR created_at <= ${toAt})
        AND (${actionFilter}::text IS NULL OR action = ${actionFilter})
        AND (${tenantFilter}::uuid IS NULL OR tenant_id = ${tenantFilter}::uuid)
        AND (
          ${cursorId}::uuid IS NULL
          OR (created_at, id) < (
            SELECT created_at, id FROM platform_audit_logs
            WHERE id = ${cursorId}::uuid
          )
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;

    const page = rows.slice(0, limit);
    const items: PortalPlatformAuditEntry[] = page.map((row) => {
      const item: PortalPlatformAuditEntry = {
        auditId: row.id,
        actorUserId: row.actor_user_id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        tenantId: row.tenant_id,
        createdAt: row.created_at.toISOString(),
      };
      const rec = item as unknown as Record<string, unknown>;
      for (const key of [...AUDIT_FORBIDDEN, 'operationId']) {
        if (key in rec) {
          throw new PlatformError(
            PLATFORM_ERROR_CODES.INVALID_INPUT,
            'Platform audit projection failed privacy check',
          );
        }
      }
      return item;
    });

    const last = page[page.length - 1];
    return {
      items,
      nextCursor:
        rows.length > limit && last ? encodeIdCursor(last.id) : null,
    };
  });
}

/** Convenience wrapper: listEventCodes inside withTenant. */
export async function listEventCodesForTenant(
  db: PrismaClient,
  hmac: CodeHmacConfig,
  input: Parameters<typeof listEventCodes>[2],
): Promise<PortalCodesPage> {
  return withTenant(db, input.tenantId, (tx) =>
    listEventCodes(tx, hmac, input),
  );
}

/** Convenience wrapper: listEventAudit inside withTenant. */
export async function listEventAuditForTenant(
  db: PrismaClient,
  input: Parameters<typeof listEventAudit>[1],
): Promise<PortalAuditPage> {
  return withTenant(db, input.tenantId, (tx) => listEventAudit(tx, input));
}
