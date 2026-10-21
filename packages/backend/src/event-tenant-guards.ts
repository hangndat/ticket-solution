import type { Prisma } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import {
  assertTenantAllowsAdminMutation,
  lockTenantPolicyForShare,
} from './tenant-policy';

/** After event row insert — allows count === max_events when this create/clone owns the slot. */
export async function assertTenantEventCountWithinLimit(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<void> {
  const lim = await tx.$queryRaw<{ max_events: number | null }[]>`
    SELECT max_events FROM tenant_limits
    WHERE tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const maxEvents = lim[0]?.max_events ?? null;
  if (maxEvents === null) return;
  const cnt = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM events WHERE tenant_id = ${tenantId}::uuid
  `;
  if ((cnt[0]?.n ?? 0) > maxEvents) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
      'Event limit reached',
    );
  }
}

export async function assertTenantAllowsAdminMutationForShare(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<void> {
  const policy = await lockTenantPolicyForShare(tx, tenantId);
  assertTenantAllowsAdminMutation(policy.status);
}
