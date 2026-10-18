import type { Prisma, PrismaClient } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { withPlatformRole } from './platform-context';

export async function requireActivePlatformOperator(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<
    { user_id: string; revoked_at: Date | null; activated_at: Date }[]
  >`
    SELECT user_id, revoked_at, activated_at
    FROM platform_operators
    WHERE user_id = ${userId}::uuid
    FOR SHARE
  `;
  const row = rows[0];
  if (!row || row.revoked_at !== null) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED,
      'Platform operator required',
    );
  }
  if (row.activated_at.getTime() > Date.now()) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED,
      'Platform operator not yet active',
    );
  }
}

export async function bootstrapPlatformOperator(
  db: PrismaClient,
  input: { userId: string },
): Promise<{ bootstrapped: true }> {
  try {
    await db.$executeRaw`SELECT bootstrap_platform_operator(${input.userId}::uuid)`;
    return { bootstrapped: true as const };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (/bootstrap_already_done/i.test(msg)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.BOOTSTRAP_ALREADY_DONE,
        'Platform already bootstrapped',
      );
    }
    throw error;
  }
}

export async function getPlatformMe(
  db: PrismaClient,
  userId: string,
): Promise<{ operator: boolean; permittedCommands: string[] }> {
  return withPlatformRole(db, async (tx) => {
    const rows = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM platform_operators
      WHERE user_id = ${userId}::uuid
        AND revoked_at IS NULL
        AND activated_at <= clock_timestamp()
    `;
    const operator = (rows[0]?.n ?? 0) > 0;
    return {
      operator,
      permittedCommands: operator
        ? [
            'platform.tenants.list',
            'platform.tenants.create',
            'platform.tenants.status',
            'platform.tenants.limits',
            'platform.support.grant',
            'platform.health.read',
          ]
        : [],
    };
  });
}

export async function withPlatformOperator<T>(
  db: PrismaClient,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${userId}, true)`;
    await requireActivePlatformOperator(tx, userId);
    return fn(tx);
  });
}
