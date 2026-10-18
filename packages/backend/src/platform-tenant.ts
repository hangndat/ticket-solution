import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import type {
  PlatformCreateTenantBody,
  PlatformTenantDetail,
  PortalPlatformTenantHealth,
  PortalPlatformTenantSummary,
  PortalPlatformTenantsPage,
  TenantFlagsDto,
  TenantLimitsDto,
} from '@ticket/contracts';
import { CURSOR_PAGE_LIMIT } from '@ticket/contracts';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { requireActivePlatformOperator } from './platform-operator';
import type { PlatformSecurityConfig } from './platform-config';
import {
  lockTenantPolicyForShare,
  lockTenantPolicyForUpdate,
} from './tenant-policy';
import { withPlatformRole } from './platform-context';
import { withTenant } from './tenant-context';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseTenantListLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return CURSOR_PAGE_LIMIT.default;
  return Math.min(
    CURSOR_PAGE_LIMIT.max,
    Math.max(CURSOR_PAGE_LIMIT.min, Math.floor(raw)),
  );
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export type ProvisionResult = {
  tenantId: string;
  status: 'PENDING';
  version: number;
  ownerInviteId: string;
  /** Raw invite token — only for encrypted outbox payload; never log. */
  rawInviteToken: string;
};

export async function provisionTenant(
  db: PrismaClient,
  security: PlatformSecurityConfig,
  input: {
    actorUserId: string;
    clientKey: string;
    body: PlatformCreateTenantBody;
  },
): Promise<ProvisionResult> {
  const slug = input.body.slug?.trim().toLowerCase() ?? '';
  const name = input.body.name?.trim() ?? '';
  const ownerEmail = canonicalizeEmail(input.body.ownerEmail ?? '');
  const tz = input.body.defaultTimezone?.trim() || 'Asia/Ho_Chi_Minh';
  if (
    !/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) ||
    name.length < 1 ||
    name.length > 200 ||
    !ownerEmail.includes('@')
  ) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid tenant provision input',
    );
  }
  if (!input.clientKey?.trim()) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key required',
    );
  }

  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        slug,
        name,
        tz,
        ownerEmail,
        limits: input.body.limits,
        flags: input.body.flags,
      }),
    )
    .digest('hex');

  const result: ProvisionResult = await withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);

    const existing = await tx.$queryRaw<
      { id: string; request_hash: string; response_json: Prisma.JsonValue }[]
    >`
      SELECT id, request_hash, response_json FROM platform_operations
      WHERE actor_user_id = ${input.actorUserId}::uuid
        AND command = 'platform.tenants.create'
        AND client_key = ${input.clientKey}
      FOR UPDATE
    `;
    if (existing[0]) {
      if (existing[0].request_hash !== requestHash) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          'Idempotency key reuse with different payload',
        );
      }
      const prev = existing[0].response_json as ProvisionResult;
      return {
        tenantId: prev.tenantId,
        status: 'PENDING',
        version: prev.version,
        ownerInviteId: prev.ownerInviteId,
        rawInviteToken: '',
      };
    }

    const tenantId = randomUUID();
    const inviteId = randomUUID();
    const rawInviteToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawInviteToken);
    const expiresAt = new Date(
      Date.now() + security.inviteTtlSeconds * 1000,
    );

    try {
      await tx.$executeRaw`
        SELECT provision_tenant(
          ${tenantId}::uuid,
          ${slug}::text,
          ${name}::text,
          ${tz}::text,
          ${input.body.contact ?? null}::text,
          ${ownerEmail}::text,
          ${inviteId}::uuid,
          ${tokenHash}::text,
          ${expiresAt}::timestamptz,
          ${input.actorUserId}::uuid,
          ${input.body.limits.maxEvents}::integer,
          ${input.body.limits.maxStaff}::integer,
          ${input.body.limits.emailPerDay}::integer,
          ${input.body.limits.importRowsPerJob}::integer,
          ${input.body.flags.importsEnabled}::boolean,
          ${input.body.flags.exportsEnabled}::boolean
        )
      `;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (/unique|duplicate/i.test(msg)) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.SLUG_TAKEN,
          'Tenant slug taken',
        );
      }
      throw error;
    }

    const result: ProvisionResult = {
      tenantId,
      status: 'PENDING',
      version: 1,
      ownerInviteId: inviteId,
      rawInviteToken,
    };

    await tx.$executeRaw`
      INSERT INTO platform_operations (
        id, actor_user_id, command, client_key, request_hash, status, response_json
      ) VALUES (
        ${randomUUID()}::uuid, ${input.actorUserId}::uuid,
        'platform.tenants.create', ${input.clientKey}, ${requestHash},
        'COMPLETED',
        ${JSON.stringify({
          tenantId,
          status: 'PENDING',
          version: 1,
          ownerInviteId: inviteId,
        })}::jsonb
      )
    `;
    await tx.$executeRaw`
      INSERT INTO platform_audit_logs (
        id, actor_user_id, action, resource_type, resource_id, tenant_id, sanitized_diff
      ) VALUES (
        ${randomUUID()}::uuid, ${input.actorUserId}::uuid,
        'platform.tenant.created', 'tenant', ${tenantId}::uuid, ${tenantId}::uuid,
        ${JSON.stringify({ slug })}::jsonb
      )
    `;
    return result;
  });

  await withTenant(db, result.tenantId, async (tx) => {
    await tx.$executeRaw`
      INSERT INTO outbox (
        tenant_id, event_id, id, type, aggregate_id, payload_version,
        payload, status, attempts, created_at, updated_at
      ) VALUES (
        ${result.tenantId}::uuid, NULL, ${randomUUID()}::uuid,
        'MembershipInvite', ${result.ownerInviteId}::uuid, 1,
        ${JSON.stringify({
          inviteId: result.ownerInviteId,
          email: canonicalizeEmail(input.body.ownerEmail),
          role: 'Owner',
          token: result.rawInviteToken,
          expiresAt: new Date(
            Date.now() + security.inviteTtlSeconds * 1000,
          ).toISOString(),
        })}::jsonb,
        'PENDING', 0, now(), now()
      )
    `;
  });
  return result;
}

export async function setTenantStatus(
  db: PrismaClient,
  input: {
    actorUserId: string;
    tenantId: string;
    status: 'ACTIVE' | 'SUSPENDED';
    reason: string;
    expectedVersion: number;
  },
): Promise<{ version: number; status: string }> {
  if (!input.reason?.trim() || input.reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason required',
    );
  }
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);
    const row = await lockTenantPolicyForUpdate(tx, input.tenantId);
    if (row.version !== input.expectedVersion) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.STALE_VERSION,
        'Stale tenant version',
      );
    }
    if (input.status === 'ACTIVE') {
      const owners = await tx.$queryRaw<{ ok: boolean }[]>`
        SELECT platform_tenant_has_active_owner(${input.tenantId}::uuid) AS ok
      `;
      if (!owners[0]?.ok) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
          'ACTIVE requires an active Owner',
        );
      }
    }
    const next = row.version + 1;
    await tx.$executeRaw`
      UPDATE tenants
      SET status = ${input.status}, version = ${next}, updated_at = now()
      WHERE id = ${input.tenantId}::uuid
    `;
    await tx.$executeRaw`
      INSERT INTO platform_audit_logs (
        id, actor_user_id, action, resource_type, resource_id, tenant_id, sanitized_diff
      ) VALUES (
        ${randomUUID()}::uuid, ${input.actorUserId}::uuid,
        'platform.tenant.status', 'tenant', ${input.tenantId}::uuid,
        ${input.tenantId}::uuid,
        ${JSON.stringify({ status: input.status, reasonLen: input.reason.length })}::jsonb
      )
    `;
    return { version: next, status: input.status };
  });
}

export async function updateTenantLimits(
  db: PrismaClient,
  input: {
    actorUserId: string;
    tenantId: string;
    limits: TenantLimitsDto;
    flags: TenantFlagsDto;
    reason: string;
    expectedVersion: number;
  },
): Promise<{ version: number }> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);
    const limits = await tx.$queryRaw<{ version: number }[]>`
      SELECT version FROM tenant_limits
      WHERE tenant_id = ${input.tenantId}::uuid
      FOR UPDATE
    `;
    if (!limits[0]) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Limits not found',
      );
    }
    if (limits[0].version !== input.expectedVersion) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.STALE_VERSION,
        'Stale limits version',
      );
    }
    const usage = await tx.$queryRaw<
      { events: number; staff_active: number }[]
    >`
      SELECT events, staff_active
      FROM platform_tenant_usage_counts(${input.tenantId}::uuid)
    `;
    const u = {
      events: usage[0]?.events ?? 0,
      staff: usage[0]?.staff_active ?? 0,
    };
    if (
      input.limits.maxEvents !== null &&
      input.limits.maxEvents < u.events
    ) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.LIMIT_BELOW_USAGE,
        'maxEvents below usage',
      );
    }
    if (input.limits.maxStaff !== null && input.limits.maxStaff < u.staff) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.LIMIT_BELOW_USAGE,
        'maxStaff below usage',
      );
    }
    const next = limits[0].version + 1;
    await tx.$executeRaw`
      UPDATE tenant_limits SET
        max_events = ${input.limits.maxEvents},
        max_staff = ${input.limits.maxStaff},
        email_per_day = ${input.limits.emailPerDay},
        import_rows_per_job = ${input.limits.importRowsPerJob},
        imports_enabled = ${input.flags.importsEnabled},
        exports_enabled = ${input.flags.exportsEnabled},
        version = ${next},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
    `;
    void input.reason;
    return { version: next };
  });
}

export async function getPlatformTenantDetail(
  db: PrismaClient,
  actorUserId: string,
  tenantId: string,
): Promise<PlatformTenantDetail> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${actorUserId}, true)`;
    await requireActivePlatformOperator(tx, actorUserId);
    const t = await lockTenantPolicyForShare(tx, tenantId);
    const lim = await tx.$queryRaw<
      {
        max_events: number | null;
        max_staff: number | null;
        email_per_day: number | null;
        import_rows_per_job: number | null;
        imports_enabled: boolean;
        exports_enabled: boolean;
        version: number;
      }[]
    >`
      SELECT * FROM tenant_limits WHERE tenant_id = ${tenantId}::uuid
    `;
    const L = lim[0];
    if (!L) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Limits not found',
      );
    }
    const usage = await tx.$queryRaw<
      {
        events: number;
        staff_active: number;
        staff_pending: number;
        email_today: number;
      }[]
    >`
      SELECT events, staff_active, staff_pending, email_today
      FROM platform_tenant_usage_counts(${tenantId}::uuid)
    `;
    const u = usage[0]!;
    return {
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      defaultTimezone: t.default_timezone,
      contact: t.contact,
      version: t.version,
      limits: {
        maxEvents: L.max_events,
        maxStaff: L.max_staff,
        emailPerDay: L.email_per_day,
        importRowsPerJob: L.import_rows_per_job,
      },
      flags: {
        importsEnabled: L.imports_enabled,
        exportsEnabled: L.exports_enabled,
      },
      usage: {
        events: u.events,
        staffActive: u.staff_active,
        staffPendingInvites: u.staff_pending,
        emailToday: u.email_today,
      },
    };
  });
}

type PlatformTenantListRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  version: number;
  created_at: Date;
};

/**
 * H-P2 / ADR-20: sanitized operational counters only — no payloads, recipients, or SLA.
 */
export async function getPlatformTenantHealth(
  db: PrismaClient,
  actorUserId: string,
  tenantId: string,
): Promise<PortalPlatformTenantHealth> {
  if (!UUID_RE.test(tenantId)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid tenantId',
    );
  }
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${actorUserId}, true)`;
    await requireActivePlatformOperator(tx, actorUserId);
    await lockTenantPolicyForShare(tx, tenantId);

    const health = await tx.$queryRaw<
      {
        notifications_pending: number;
        notifications_failed: number;
        notifications_dead: number;
        outbox_pending: number;
        outbox_failed: number;
      }[]
    >`
      SELECT
        notifications_pending,
        notifications_failed,
        notifications_dead,
        outbox_pending,
        outbox_failed
      FROM platform_tenant_health_counts(${tenantId}::uuid)
    `;
    const h = health[0]!;

    const usage = await tx.$queryRaw<
      {
        events: number;
        staff_active: number;
        staff_pending: number;
        email_today: number;
      }[]
    >`
      SELECT events, staff_active, staff_pending, email_today
      FROM platform_tenant_usage_counts(${tenantId}::uuid)
    `;
    const u = usage[0]!;

    return {
      tenantId,
      observedAt: new Date().toISOString(),
      notifications: {
        pending: h.notifications_pending,
        failed: h.notifications_failed,
        dead: h.notifications_dead,
      },
      outbox: {
        pending: h.outbox_pending,
        failed: h.outbox_failed,
      },
      usage: {
        events: u.events,
        staffActive: u.staff_active,
        staffPendingInvites: u.staff_pending,
        emailToday: u.email_today,
      },
    };
  });
}

/**
 * H-P1 / ADR-20: operator + MFA platform audience lists tenant metadata only.
 * Cursor is the prior page's last tenantId (uuid); invalid cursors → INVALID_INPUT.
 */
export async function listPlatformTenants(
  db: PrismaClient,
  input: {
    actorUserId: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<PortalPlatformTenantsPage> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);

    const limit = parseTenantListLimit(input.limit);
    const cursor = input.cursor?.trim() || null;
    if (cursor && !UUID_RE.test(cursor)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVALID_INPUT,
        'Invalid cursor',
      );
    }

    const rows = cursor
      ? await tx.$queryRaw<PlatformTenantListRow[]>`
          SELECT id, slug, name, status, version, created_at
          FROM tenants
          WHERE id > ${cursor}::uuid
          ORDER BY id ASC
          LIMIT ${limit + 1}
        `
      : await tx.$queryRaw<PlatformTenantListRow[]>`
          SELECT id, slug, name, status, version, created_at
          FROM tenants
          ORDER BY id ASC
          LIMIT ${limit + 1}
        `;

    const page = rows.slice(0, limit);
    const items: PortalPlatformTenantSummary[] = page.map((r) => ({
      tenantId: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status as PortalPlatformTenantSummary['status'],
      version: r.version,
      createdAt: r.created_at.toISOString(),
    }));
    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.id : null;
    return { items, nextCursor };
  });
}
