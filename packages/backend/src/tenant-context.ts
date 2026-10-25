import type { PrismaClient, Prisma } from './generated/prisma/client';

/** Only call after identity, active membership and operation authorization.
 * This primitive is not authentication: never populate it from an unchecked header.
 * Callback must use tx exclusively and must not escape/retain it.
 * Do not use for the global users table.
 */
export async function withTenant<T>(
  db: PrismaClient,
  tenantId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  limits: {
    statementTimeoutMs?: number;
    maxWaitMs?: number;
    transactionTimeoutMs?: number;
  } = {},
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId,
    )
  ) {
    throw new Error('Invalid tenant ID');
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(limits.statementTimeoutMs ?? 5000)}, true)`;
      return operation(tx);
    },
    {
      maxWait: limits.maxWaitMs ?? 5000,
      timeout: limits.transactionTimeoutMs ?? 10000,
    },
  );
}

/** Bind verified identity to transaction-local app.actor_id for user-scoped tables.
 * Never populate from an unchecked client header — only from verified OIDC subject mapping.
 * Do not use for tenant-scoped tables (use withTenant).
 */
export async function withActor<T>(
  db: PrismaClient,
  actorId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      actorId,
    )
  ) {
    throw new Error('Invalid actor ID');
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.actor_id', ${actorId}, true)`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', '5000', true)`;
      return operation(tx);
    },
    { maxWait: 5000, timeout: 10000 },
  );
}

