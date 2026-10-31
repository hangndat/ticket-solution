import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import { withTenant } from './tenant-context';

export type EmailBudgetClaim = {
  tenantId: string;
  outboxId: string;
  leaseToken: string;
};

export type EmailBudgetAdmission =
  | { kind: 'reserved'; attemptId: string }
  | { kind: 'deferred'; reason: 'email_budget_deferred' | 'email_budget_config_missing'; due: Date }
  | { kind: 'duplicate' | 'stale' };

/** One lease may enter SMTP only once; the outbox row serializes duplicate callers. */
export async function reserveEmailBudget(
  db: PrismaClient,
  claim: EmailBudgetClaim,
): Promise<EmailBudgetAdmission> {
  return withTenant(db, claim.tenantId, async (tx) => {
    const lease = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM outbox
      WHERE tenant_id = ${claim.tenantId}::uuid AND id = ${claim.outboxId}::uuid
        AND lease_token = ${claim.leaseToken} AND status = 'PROCESSING'
        AND lease_expires_at > clock_timestamp()
      FOR UPDATE
    `;
    if (!lease[0]) return { kind: 'stale' };
    await tx.$executeRaw`
      UPDATE tenant_email_budget_attempts b
      SET state = 'UNKNOWN', updated_at = clock_timestamp()
      FROM outbox o
      WHERE b.tenant_id = ${claim.tenantId}::uuid AND b.state = 'HELD'
        AND o.tenant_id = b.tenant_id AND o.id = b.outbox_id
        AND (o.lease_token IS DISTINCT FROM b.lease_token
          OR o.lease_expires_at IS NULL OR o.lease_expires_at <= clock_timestamp())
    `;
    const existing = await tx.$queryRaw<Array<{ attempt_id: string }>>`
      SELECT attempt_id FROM tenant_email_budget_attempts
      WHERE tenant_id = ${claim.tenantId}::uuid AND outbox_id = ${claim.outboxId}::uuid
        AND lease_token = ${claim.leaseToken}
    `;
    if (existing[0]) return { kind: 'duplicate' };

    // The share lock serializes admission with an operator changing the limit.
    const limits = await tx.$queryRaw<Array<{
      email_per_day: number | null;
      usage_date: string;
      next_day: Date;
    }>>`
      WITH admission_clock AS (SELECT clock_timestamp() AS at)
      SELECT l.email_per_day,
        (admission_clock.at AT TIME ZONE 'UTC')::date::text AS usage_date,
        (((admission_clock.at AT TIME ZONE 'UTC')::date + 1)::timestamp
          AT TIME ZONE 'UTC') AS next_day
      FROM tenant_limits l CROSS JOIN admission_clock
      WHERE l.tenant_id = ${claim.tenantId}::uuid FOR SHARE OF l
    `;
    if (!limits[0]) {
      return {
        kind: 'deferred',
        reason: 'email_budget_config_missing',
        due: new Date(Date.now() + 300_000),
      };
    }
    const { usage_date: usageDate, next_day: nextDay } = limits[0];
    await tx.$executeRaw`
      INSERT INTO tenant_email_usage (tenant_id, usage_date)
      VALUES (${claim.tenantId}::uuid, ${usageDate}::date)
      ON CONFLICT (tenant_id, usage_date) DO NOTHING
    `;
    const changed = await tx.$queryRaw<Array<{ held_count: number }>>`
      UPDATE tenant_email_usage
      SET held_count = held_count + 1
      WHERE tenant_id = ${claim.tenantId}::uuid AND usage_date = ${usageDate}::date
        AND (${limits[0].email_per_day}::integer IS NULL
          OR sent_count + held_count < ${limits[0].email_per_day}::integer)
      RETURNING held_count
    `;
    if (!changed[0]) {
      return { kind: 'deferred', reason: 'email_budget_deferred', due: nextDay };
    }
    const attemptId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO tenant_email_budget_attempts
        (tenant_id, attempt_id, outbox_id, lease_token, usage_date, state)
      VALUES (${claim.tenantId}::uuid, ${attemptId}::uuid,
        ${claim.outboxId}::uuid, ${claim.leaseToken}, ${usageDate}::date, 'HELD')
    `;
    return { kind: 'reserved', attemptId };
  });
}

/** Settlement deliberately does not require a live outbox lease. */
export async function settleEmailBudget(
  db: PrismaClient,
  tenantId: string,
  attemptId: string,
  state: 'ACCEPTED' | 'UNKNOWN' | 'RELEASED',
  providerRef: string | null = null,
): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const attempts = await tx.$queryRaw<Array<{ usage_date: string; state: string }>>`
      SELECT usage_date::text AS usage_date, state FROM tenant_email_budget_attempts
      WHERE tenant_id = ${tenantId}::uuid AND attempt_id = ${attemptId}::uuid
      FOR UPDATE
    `;
    const current = attempts[0];
    if (!current) throw new Error('email_budget_attempt_missing');
    if (current.state === state) return;
    if (current.state === 'ACCEPTED' || current.state === 'RELEASED') {
      throw new Error('email_budget_settlement_conflict');
    }
    if (state === 'UNKNOWN') {
      await tx.$executeRaw`
        UPDATE tenant_email_budget_attempts SET state = 'UNKNOWN', updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND attempt_id = ${attemptId}::uuid
      `;
      return;
    }
    const updated = await tx.$executeRaw`
      UPDATE tenant_email_usage
      SET held_count = held_count - 1,
          sent_count = sent_count + ${state === 'ACCEPTED' ? 1 : 0}::integer
      WHERE tenant_id = ${tenantId}::uuid AND usage_date = ${current.usage_date}::date
        AND held_count > 0
    `;
    if (Number(updated) !== 1) throw new Error('email_budget_counter_invariant');
    await tx.$executeRaw`
      UPDATE tenant_email_budget_attempts
      SET state = ${state}, provider_ref = ${providerRef}, updated_at = clock_timestamp()
      WHERE tenant_id = ${tenantId}::uuid AND attempt_id = ${attemptId}::uuid
    `;
  });
}

/** Expired or reclaimed leases keep their hold; only evidence can release it. */
export async function reconcileExpiredEmailBudget(
  db: PrismaClient,
  tenantId: string,
): Promise<number> {
  return withTenant(db, tenantId, async (tx) => Number(await tx.$executeRaw`
    UPDATE tenant_email_budget_attempts b
    SET state = 'UNKNOWN', updated_at = clock_timestamp()
    FROM outbox o
    WHERE b.tenant_id = ${tenantId}::uuid AND b.state = 'HELD'
      AND o.tenant_id = b.tenant_id AND o.id = b.outbox_id
      AND (o.lease_token IS DISTINCT FROM b.lease_token
        OR o.lease_expires_at IS NULL OR o.lease_expires_at <= clock_timestamp())
  `));
}
