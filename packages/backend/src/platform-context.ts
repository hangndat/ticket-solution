import type { PrismaClient, Prisma } from './generated/prisma/client';

/** Run work as ticket_platform_runtime (NOBYPASSRLS metadata pool). */
export async function withPlatformRole<T>(
  db: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE ticket_platform_runtime');
    return operation(tx);
  });
}
