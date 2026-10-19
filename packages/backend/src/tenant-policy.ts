import type { Prisma } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';

export type TenantPolicyRow = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  version: number;
  name: string;
  slug: string;
  default_timezone: string;
  contact: string | null;
};

/** Lock tenant policy FOR SHARE — issue/admin must check status/limits. */
export async function lockTenantPolicyForShare(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<TenantPolicyRow> {
  const rows = await tx.$queryRaw<TenantPolicyRow[]>`
    SELECT id, status, version, name, slug, default_timezone, contact
    FROM tenants
    WHERE id = ${tenantId}::uuid
    FOR SHARE
  `;
  const row = rows[0];
  if (!row) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Tenant not found',
    );
  }
  return row;
}

export async function lockTenantPolicyForUpdate(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<TenantPolicyRow> {
  const rows = await tx.$queryRaw<TenantPolicyRow[]>`
    SELECT id, status, version, name, slug, default_timezone, contact
    FROM tenants
    WHERE id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Tenant not found',
    );
  }
  return row;
}

/**
 * SUSPENDED: block admin mutations / issue / import / resend.
 * Allow owner-read tickets, Gate, recovery, revoke membership/support.
 */
export function assertTenantAllowsIssue(status: string): void {
  if (status === 'SUSPENDED') {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.TENANT_SUSPENDED,
      'Tenant is suspended',
      false,
    );
  }
  if (status === 'PENDING') {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.TENANT_PENDING,
      'Tenant is pending activation',
      false,
    );
  }
}

export function assertTenantAllowsAdminMutation(status: string): void {
  assertTenantAllowsIssue(status);
}
