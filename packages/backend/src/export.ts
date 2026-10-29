import { randomUUID } from 'node:crypto';
import type { CursorPage } from '@ticket/contracts';
import { CURSOR_PAGE_LIMIT } from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import { ExportError, EXPORT_ERROR_CODES } from './export-error';
import { toCsvRow } from './csv-guard';
import {
  getObject,
  putObject,
  requireMinioExportsConfig,
  type MinioConfig,
} from './minio';
import { withTenant } from './tenant-context';
import { maskEmail } from './notification-status';

const PERMISSION_CREATE = 'export.create';
const PERMISSION_DOWNLOAD = 'export.download';
const ALLOWED_STATES = new Set(['ACTIVE', 'REVOKED', 'CANCELLED', 'USED']);
const JOB_STATUSES = new Set(['PENDING', 'PROCESSING', 'READY', 'FAILED']);
const DEFAULT_TTL_SECONDS = 86400;
const STATEMENT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 20_000;
// A deployment pause is applied to both the API admission path and worker claim
// path. Existing processes must still be stopped before the offline purge.
export function exportWritesPaused(env: NodeJS.ProcessEnv): boolean {
  return env['EXPORT_WRITES_PAUSED'] === '1';
}

export type ExportFilter = {
  states?: string[];
  from?: string;
  to?: string;
};

export type ExportJob = {
  exportId: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  rowCount: number | null;
  expiresAt: string | null;
  error: string | null;
  replayed?: boolean;
};

/** List projection — never includes object keys or download URLs (G-E1). */
export type ExportJobSummary = ExportJob & { createdAt: string };

export type ExportJobsPage = CursorPage<ExportJobSummary>;

function decodeExportCursor(cursor: string | undefined): {
  createdAt: string;
  id: string;
} | null {
  if (cursor === undefined || cursor === null || cursor.trim() === '') {
    return null;
  }
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      throw new ExportError(
        EXPORT_ERROR_CODES.INVALID_CURSOR,
        'Invalid cursor',
      );
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch (err) {
    if (err instanceof ExportError) throw err;
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_CURSOR,
      'Invalid cursor',
    );
  }
}

function encodeExportCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    'utf8',
  ).toString('base64url');
}

function parseTtlSeconds(env: NodeJS.ProcessEnv): number {
  const raw = Number(env['EXPORT_TTL_SECONDS'] ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw < 60 || raw > 7 * 86400) {
    return DEFAULT_TTL_SECONDS;
  }
  return Math.floor(raw);
}

function assertTtlSeconds(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 7 * 86400) {
    throw new ExportError(EXPORT_ERROR_CODES.INVALID_FILTER, 'Invalid export TTL');
  }
}

function validateFilter(filter: ExportFilter | undefined): ExportFilter {
  const out: ExportFilter = {};
  if (!filter) return out;
  if (filter.states) {
    if (!Array.isArray(filter.states) || filter.states.length > 8) {
      throw new ExportError(
        EXPORT_ERROR_CODES.INVALID_FILTER,
        'Invalid states filter',
      );
    }
    for (const s of filter.states) {
      if (!ALLOWED_STATES.has(s)) {
        throw new ExportError(
          EXPORT_ERROR_CODES.INVALID_FILTER,
          'Invalid ticket state',
        );
      }
    }
    out.states = filter.states;
  }
  if (filter.from) {
    if (Number.isNaN(Date.parse(filter.from))) {
      throw new ExportError(EXPORT_ERROR_CODES.INVALID_FILTER, 'Invalid from');
    }
    out.from = filter.from;
  }
  if (filter.to) {
    if (Number.isNaN(Date.parse(filter.to))) {
      throw new ExportError(EXPORT_ERROR_CODES.INVALID_FILTER, 'Invalid to');
    }
    out.to = filter.to;
  }
  return out;
}

function mapJob(row: {
  id: string;
  status: string;
  row_count: number | null;
  expires_at: Date | null;
  error_code: string | null;
}): ExportJob {
  return {
    exportId: row.id,
    status: row.status as ExportJob['status'],
    rowCount: row.row_count,
    expiresAt: row.expires_at?.toISOString() ?? null,
    error: row.error_code,
  };
}

export async function createExportJob(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    clientKey: string;
    filter?: ExportFilter;
    ttlSeconds: number;
  },
): Promise<ExportJob> {
  assertTtlSeconds(input.ttlSeconds);
  if (!input.clientKey?.trim()) {
    throw new ExportError(
      EXPORT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key required',
    );
  }
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string; allowed: boolean }[]>`
    SELECT id, export_retention_fenced_at IS NULL AND (
      ends_at IS NULL OR clock_timestamp() + (${input.ttlSeconds}::text || ' seconds')::interval
        + interval '24 hours'
        < ends_at + interval '90 days'
    ) AS allowed FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
    FOR UPDATE
  `;
  if (!events[0]) {
    throw new ExportError(
      EXPORT_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }
  if (!events[0].allowed) {
    throw new ExportError(EXPORT_ERROR_CODES.EXPORT_EXPIRED, 'Export retention cutoff reached');
  }

  const filter = validateFilter(input.filter);
  const existing = await tx.$queryRaw<
    {
      id: string;
      status: string;
      row_count: number | null;
      expires_at: Date | null;
      error_code: string | null;
    }[]
  >`
    SELECT id, status, row_count, expires_at, error_code
    FROM exports
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND client_key = ${input.clientKey}
    FOR UPDATE
  `;
  if (existing[0]) {
    return { ...mapJob(existing[0]), replayed: true };
  }

  const exportId = randomUUID();
  const auditId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO exports (
      tenant_id, event_id, id, actor_user_id, format, status, filter,
      client_key, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${exportId}::uuid,
      ${input.actorUserId}::uuid, 'csv', 'PENDING',
      ${JSON.stringify(filter)}::jsonb, ${input.clientKey}, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${auditId}::uuid,
      ${input.actorUserId}::uuid, 'export.created', 'export',
      ${exportId}::uuid, ${JSON.stringify({ format: 'csv' })}::jsonb, now()
    )
  `;

  return {
    exportId,
    status: 'PENDING',
    rowCount: null,
    expiresAt: null,
    error: null,
    replayed: false,
  };
}

export async function getExportJob(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    exportId: string;
  },
): Promise<ExportJob> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
    eventId: input.eventId,
  });
  const rows = await tx.$queryRaw<
    {
      id: string;
      status: string;
      row_count: number | null;
      expires_at: Date | null;
      error_code: string | null;
    }[]
  >`
    SELECT id, status, row_count, expires_at, error_code
    FROM exports
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.exportId}::uuid
  `;
  if (!rows[0]) {
    throw new ExportError(
      EXPORT_ERROR_CODES.EXPORT_NOT_FOUND,
      'Export not found',
    );
  }
  return mapJob(rows[0]);
}

/**
 * G-E1 — export history list (cursor + optional status). No object keys / URLs.
 */
export async function listExportJobs(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string;
    limit?: number;
    status?: ExportJob['status'];
  },
): Promise<ExportJobsPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CREATE,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new ExportError(
      EXPORT_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
    );
  }

  if (input.status != null && !JOB_STATUSES.has(input.status)) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_FILTER,
      'Invalid export status filter',
    );
  }

  const limit = Math.min(
    Math.max(input.limit ?? CURSOR_PAGE_LIMIT.default, CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
  const cursor = decodeExportCursor(input.cursor);
  const status = input.status ?? null;
  const cursorCreatedAt = cursor?.createdAt ?? null;
  const cursorId = cursor?.id ?? null;

  const rows = await tx.$queryRaw<
    {
      id: string;
      status: string;
      row_count: number | null;
      expires_at: Date | null;
      error_code: string | null;
      created_at: Date;
    }[]
  >`
    SELECT id, status, row_count, expires_at, error_code, created_at
    FROM exports
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND (${status}::text IS NULL OR status = ${status})
      AND (
        ${cursorCreatedAt}::timestamptz IS NULL
        OR created_at < ${cursorCreatedAt}::timestamptz
        OR (
          created_at = ${cursorCreatedAt}::timestamptz
          AND id < ${cursorId}::uuid
        )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 1}
  `;

  const page = rows.slice(0, limit);
  const items: ExportJobSummary[] = page.map((row) => ({
    ...mapJob(row),
    createdAt: row.created_at.toISOString(),
  }));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeExportCursor(last.created_at, last.id)
      : null;
  return { items, nextCursor };
}

/**
 * Authenticated proxy download: re-check permission + expiry every request
 * (revocation-safe). Object stays private in MinIO; client never gets a
 * long-lived public URL. Short-TTL signed URL remains optional later.
 */
export async function downloadExport(
  db: PrismaClient,
  minio: MinioConfig,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    exportId: string;
  },
): Promise<{ body: Buffer; contentType: string; filename: string }> {
  const objectKey = await withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_DOWNLOAD,
      eventId: input.eventId,
    });

    const rows = await tx.$queryRaw<
      {
        id: string;
        status: string;
        object_key: string | null;
        expires_at: Date | null;
        within_retention: boolean;
      }[]
    >`
      SELECT x.id, x.status, x.object_key, x.expires_at,
        (e.ends_at IS NULL OR clock_timestamp() < e.ends_at + interval '90 days')
          AS within_retention
      FROM exports x
      JOIN events e ON e.tenant_id = x.tenant_id AND e.id = x.event_id
      WHERE x.tenant_id = ${input.tenantId}::uuid
        AND x.event_id = ${input.eventId}::uuid
        AND x.id = ${input.exportId}::uuid
    `;
    const row = rows[0];
    if (!row) {
      throw new ExportError(
        EXPORT_ERROR_CODES.EXPORT_NOT_FOUND,
        'Export not found',
      );
    }
    if (row.status !== 'READY' || !row.object_key) {
      throw new ExportError(
        EXPORT_ERROR_CODES.EXPORT_NOT_READY,
        'Export not ready',
      );
    }
    if (!row.within_retention ||
        (row.expires_at && row.expires_at.getTime() <= Date.now())) {
      throw new ExportError(EXPORT_ERROR_CODES.EXPORT_EXPIRED, 'Export expired');
    }

    const auditId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO audit_logs (
        tenant_id, event_id, id, actor_user_id, action, resource_type,
        resource_id, created_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${auditId}::uuid,
        ${input.actorUserId}::uuid, 'export.downloaded', 'export',
        ${input.exportId}::uuid, now()
      )
    `;
    return row.object_key;
  });

  const body = await getObject(minio, objectKey);
  return {
    body,
    contentType: 'text/csv; charset=utf-8',
    filename: `export-${input.exportId}.csv`,
  };
}

async function buildCsv(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  filter: ExportFilter,
): Promise<{ csv: string; rowCount: number }> {
  await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(STATEMENT_TIMEOUT_MS)}, true)`;

  const states = filter.states?.length
    ? filter.states
    : ['ACTIVE', 'REVOKED', 'CANCELLED', 'USED'];
  const from = filter.from ? new Date(filter.from) : null;
  const to = filter.to ? new Date(filter.to) : null;

  const rows = await tx.$queryRaw<
    {
      id: string;
      state: string;
      ticket_type_id: string;
      source_id: string;
      created_at: Date;
      email: string | null;
    }[]
  >`
    SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at, u.email
    FROM tickets t
    LEFT JOIN users u ON u.id = t.owner_user_id
    WHERE t.tenant_id = ${tenantId}::uuid
      AND t.event_id = ${eventId}::uuid
      AND t.state = ANY(${states}::text[])
      AND (${from}::timestamptz IS NULL OR t.created_at >= ${from}::timestamptz)
      AND (${to}::timestamptz IS NULL OR t.created_at <= ${to}::timestamptz)
    ORDER BY t.created_at ASC, t.id ASC
    LIMIT ${MAX_ROWS}
  `;

  const lines = [
    toCsvRow([
      'ticketId',
      'state',
      'ticketTypeId',
      'sourceId',
      'createdAt',
      'ownerEmailMasked',
    ]),
  ];
  for (const r of rows) {
    lines.push(
      toCsvRow([
        r.id,
        r.state,
        r.ticket_type_id,
        r.source_id,
        r.created_at.toISOString(),
        maskEmail(r.email),
      ]),
    );
  }
  return { csv: lines.join('\n') + '\n', rowCount: rows.length };
}

export async function processExportJob(
  db: PrismaClient,
  minio: MinioConfig,
  tenantId: string,
  exportId: string,
  ttlSeconds: number,
  leaseOwner?: string,
): Promise<void> {
  assertTtlSeconds(ttlSeconds);
  // Phase 1: short txn — lock row, build CSV, release before network I/O.
  const prepared = await withTenant(db, tenantId, async (tx) => {
    const identity = await tx.$queryRaw<{ event_id: string }[]>`
      SELECT event_id FROM exports
      WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
    `;
    if (!identity[0]) return null;
    const event = await tx.$queryRaw<{ allowed: boolean }[]>`
      SELECT export_retention_fenced_at IS NULL AND (
        ends_at IS NULL OR clock_timestamp() + (${ttlSeconds}::text || ' seconds')::interval
          + interval '24 hours'
          < ends_at + interval '90 days'
      ) AS allowed FROM events
      WHERE tenant_id = ${tenantId}::uuid AND id = ${identity[0].event_id}::uuid
      FOR UPDATE
    `;
    const rows = await tx.$queryRaw<
      {
        id: string;
        event_id: string;
        status: string;
        filter: Prisma.JsonValue;
        lease_owner: string | null;
      }[]
    >`
      SELECT id, event_id, status, filter, lease_owner
      FROM exports
      WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
      FOR UPDATE
    `;
    const job = rows[0];
    if (!job || (job.status !== 'PROCESSING' && job.status !== 'PENDING')) {
      return null;
    }
    if (job.event_id !== identity[0].event_id) return null;
    if (!event[0]?.allowed) {
      await tx.$executeRaw`
        UPDATE exports SET status = 'FAILED', error_code = 'EXPORT_EXPIRED',
          lease_owner = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
      `;
      return null;
    }
    if (
      leaseOwner &&
      job.status === 'PROCESSING' &&
      job.lease_owner &&
      job.lease_owner !== leaseOwner
    ) {
      // Another worker owns the live lease.
      return null;
    }
    if (job.status === 'PENDING') {
      await tx.$executeRaw`
        UPDATE exports
        SET status = 'PROCESSING',
            lease_owner = ${leaseOwner ?? null},
            lease_expires_at = now() + interval '120 seconds',
            updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
      `;
    }

    const filter = (job.filter ?? {}) as ExportFilter;
    const { csv, rowCount } = await buildCsv(
      tx,
      tenantId,
      job.event_id,
      filter,
    );
    const objectKey = `exports/${tenantId}/${job.event_id}/${exportId}.csv`;
    return { csv, rowCount, objectKey, eventId: job.event_id };
  });

  if (!prepared) return;

  // Keep the event lock from the last eligibility check until the object PUT
  // and READY transition finish. The operator fence takes the same lock, so
  // it cannot pass a live writer whose request is still in this transaction.
  // Keep this below the worker's 60s relay step budget: phase 1 has a 10s
  // transaction budget, PUT has 40s, and phase 2 has a 45s transaction cap.
  await withTenant(db, tenantId, async (tx) => {
    const event = await tx.$queryRaw<{ allowed: boolean }[]>`
      SELECT export_retention_fenced_at IS NULL AND (
        ends_at IS NULL OR clock_timestamp() + (${ttlSeconds}::text || ' seconds')::interval
          + interval '24 hours'
          < ends_at + interval '90 days'
      ) AS allowed FROM events
      WHERE tenant_id = ${tenantId}::uuid AND id = ${prepared.eventId}::uuid
      FOR UPDATE
    `;
    const rows = await tx.$queryRaw<{ status: string; lease_owner: string | null }[]>`
      SELECT status, lease_owner FROM exports
      WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid FOR UPDATE
    `;
    const job = rows[0];
    if (!job || job.status !== 'PROCESSING' ||
        (leaseOwner && job.lease_owner !== leaseOwner)) return;
    if (!event[0]?.allowed) {
      await tx.$executeRaw`
        UPDATE exports SET status = 'FAILED', error_code = 'EXPORT_EXPIRED',
          lease_owner = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
          AND status = 'PROCESSING' AND purged_at IS NULL
      `;
      return;
    }
    try {
      await putObject(minio, prepared.objectKey,
        Buffer.from(prepared.csv, 'utf8'), 'text/csv; charset=utf-8', 40_000);
    } catch {
      // A request timeout can have an ambiguous server outcome. Offline
      // inventory removes any orphan, version, or partial multipart upload.
      await tx.$executeRaw`
        UPDATE exports SET status = 'FAILED', error_code = 'EXPORT_FAILED',
          lease_owner = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${exportId}::uuid
          AND status = 'PROCESSING' AND purged_at IS NULL
      `;
      return;
    }
    await tx.$executeRaw`
      UPDATE exports
      SET status = 'READY',
          row_count = ${prepared.rowCount},
          object_key = ${prepared.objectKey},
          error_code = NULL,
          expires_at = LEAST(
            clock_timestamp() + (${ttlSeconds}::text || ' seconds')::interval,
            (SELECT ends_at + interval '89 days' FROM events
             WHERE tenant_id = ${tenantId}::uuid AND id = ${prepared.eventId}::uuid)
          ),
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${exportId}::uuid
        AND status = 'PROCESSING'
        AND lease_owner IS NOT DISTINCT FROM ${leaseOwner ?? null}::text
        AND purged_at IS NULL
    `;
  }, { transactionTimeoutMs: 45_000 });
}

export async function relayExportsOnce(
  db: PrismaClient,
  env: NodeJS.ProcessEnv,
  leaseOwner: string,
  limit = 5,
): Promise<{ claimed: number; completed: number; failed: number }> {
  if (exportWritesPaused(env)) return { claimed: 0, completed: 0, failed: 0 };
  const minio = requireMinioExportsConfig(env);
  const ttl = parseTtlSeconds(env);
  const claimed = await db.$queryRaw<
    { export_id: string; tenant_id: string; event_id: string }[]
  >`
    SELECT export_id, tenant_id, event_id
    FROM claim_exports_batch(${limit}::integer, ${leaseOwner}::text, ${ttl}::integer)
  `;
  let completed = 0;
  let failed = 0;
  for (const row of claimed) {
    try {
      await processExportJob(
        db,
        minio,
        row.tenant_id,
        row.export_id,
        ttl,
        leaseOwner,
      );
      completed += 1;
    } catch {
      failed += 1;
    }
  }
  return { claimed: claimed.length, completed, failed };
}

export { parseTtlSeconds, requireMinioExportsConfig };
