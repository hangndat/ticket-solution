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
      await tx.$queryRaw`SELECT set_config('statement_timeout', '5000', true)`;
      return operation(tx);
    },
    { maxWait: 5000, timeout: 10000 },
  );
}
