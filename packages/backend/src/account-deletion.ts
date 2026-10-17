import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { withActor } from './tenant-context';

/** ACK-only: never erase identity/tickets/audit. O06 policy unresolved. */
export async function createAccountDeletionRequest(
  db: PrismaClient,
  input: { userId: string; confirmation: true },
): Promise<{
  requestId: string;
  state: 'AWAITING_POLICY';
  requestedAt: string;
  policyStatus: 'UNRESOLVED';
}> {
  if (input.confirmation !== true) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'confirmation required',
    );
  }
  return withActor(db, input.userId, async (tx) => {
    const open = await tx.$queryRaw<{ id: string; state: string; requested_at: Date }[]>`
      SELECT id, state, requested_at FROM account_deletion_requests
      WHERE user_id = ${input.userId}::uuid
        AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
      FOR UPDATE
    `;
    if (open[0]) {
      return {
        requestId: open[0].id,
        state: 'AWAITING_POLICY' as const,
        requestedAt: open[0].requested_at.toISOString(),
        policyStatus: 'UNRESOLVED' as const,
      };
    }
    const requestId = randomUUID();
    const requestedAt = new Date();
    await tx.$executeRaw`
      INSERT INTO account_deletion_requests (
        id, user_id, state, requested_at, policy_version
      ) VALUES (
        ${requestId}::uuid, ${input.userId}::uuid, 'AWAITING_POLICY',
        ${requestedAt}::timestamptz, NULL
      )
    `;
    return {
      requestId,
      state: 'AWAITING_POLICY' as const,
      requestedAt: requestedAt.toISOString(),
      policyStatus: 'UNRESOLVED' as const,
    };
  });
}

export async function getCurrentAccountDeletionRequest(
  db: PrismaClient,
  userId: string,
): Promise<{
  requestId: string;
  state: string;
  requestedAt: string;
  policyStatus: 'UNRESOLVED' | 'RESOLVED';
} | null> {
  return withActor(db, userId, async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; state: string; requested_at: Date; policy_version: string | null }[]
    >`
      SELECT id, state, requested_at, policy_version
      FROM account_deletion_requests
      WHERE user_id = ${userId}::uuid
      ORDER BY requested_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      requestId: row.id,
      state: row.state,
      requestedAt: row.requested_at.toISOString(),
      policyStatus: row.policy_version ? 'RESOLVED' : 'UNRESOLVED',
    };
  });
}
