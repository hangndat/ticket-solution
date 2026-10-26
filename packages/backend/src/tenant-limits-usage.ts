import type { TenantLimitsUsageReadDto } from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import { withTenant } from './tenant-context';

export async function authorizeTenantLimitsRead(
  db: PrismaClient,
  tenantId: string,
  actorUserId: string,
): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId,
      userId: actorUserId,
      permission: 'tenant.profile',
    });
  });
}

/** A single SQL statement keeps the four counters and UTC date on one DB clock. */
async function readSnapshot(
  tx: Prisma.TransactionClient,
  tenantId: string,
  asOfOverride?: Date,
): Promise<TenantLimitsUsageReadDto | null> {
  const rows = await tx.$queryRaw<
    {
      max_events: number | null;
      max_staff: number | null;
      email_per_day: number | null;
      import_rows_per_job: number | null;
      events: number;
      staff_active: number;
      staff_pending: number;
      email_today: number;
      as_of: string;
      email_usage_date: string;
    }[]
  >`
    WITH snapshot AS (SELECT COALESCE(${asOfOverride?.toISOString() ?? null}::timestamptz, clock_timestamp()) AS as_of)
    SELECT
      lim.max_events, lim.max_staff, lim.email_per_day, lim.import_rows_per_job,
      (SELECT count(*)::integer FROM events e
        WHERE e.tenant_id = ${tenantId}::uuid) AS events,
      (SELECT count(*)::integer FROM memberships m
        WHERE m.tenant_id = ${tenantId}::uuid
          AND m.revoked_at IS NULL AND m.activated_at <= snapshot.as_of
      ) AS staff_active,
      (SELECT count(*)::integer FROM membership_invites i
        WHERE i.tenant_id = ${tenantId}::uuid
          AND i.revoked_at IS NULL AND i.accepted_at IS NULL
          AND i.expires_at > snapshot.as_of
      ) AS staff_pending,
      COALESCE((SELECT eu.sent_count FROM tenant_email_usage eu
        WHERE eu.tenant_id = ${tenantId}::uuid
          AND eu.usage_date = (snapshot.as_of AT TIME ZONE 'UTC')::date
      ), 0)::integer AS email_today,
      to_char(snapshot.as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS as_of,
      to_char(snapshot.as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS email_usage_date
    FROM tenant_limits lim CROSS JOIN snapshot
    WHERE lim.tenant_id = ${tenantId}::uuid
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    tenantId,
    limits: {
      maxEvents: row.max_events,
      maxStaff: row.max_staff,
      emailPerDay: row.email_per_day,
      importRowsPerJob: row.import_rows_per_job,
    },
    usage: {
      events: row.events,
      staffActive: row.staff_active,
      staffPendingInvites: row.staff_pending,
      emailToday: row.email_today,
    },
    asOf: row.as_of,
    emailUsageDate: row.email_usage_date,
  };
}

export async function readTenantLimitsUsage(
  db: PrismaClient,
  tenantId: string,
  actorUserId: string,
  // Controlled clock for DB boundary tests; API callers use the DB clock.
  asOfOverride?: Date,
): Promise<TenantLimitsUsageReadDto | null> {
  return withTenant(db, tenantId, async (tx) => {
    // Recheck after the limiter in this transaction; a concurrent revoke cannot
    // complete while the share lock is held through the snapshot read.
    await requireTenantPermission(tx, {
      tenantId,
      userId: actorUserId,
      permission: 'tenant.profile',
    });
    return readSnapshot(tx, tenantId, asOfOverride);
  });
}
