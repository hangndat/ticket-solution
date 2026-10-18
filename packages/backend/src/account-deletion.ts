import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { withActor } from './tenant-context';
import {
  O06_ACCOUNT_ANONYMIZE_POLICY_VERSION,
  O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
} from './retention-o06';

export type AccountDeletionAck = {
  requestId: string;
  state: 'REQUESTED';
  requestedAt: string;
  policyStatus: 'RESOLVED';
  /** O06 SLA: anonymize must complete within this many days of request. */
  anonymizeWithinDays: typeof O06_ACCOUNT_ANONYMIZE_MAX_DAYS;
};

/** ACK accepted under O06 — schedules anonymize pipeline (≤30 days). Never erases audit. */
export async function createAccountDeletionRequest(
  db: PrismaClient,
  input: { userId: string; confirmation: true },
): Promise<AccountDeletionAck> {
  if (input.confirmation !== true) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'confirmation required',
    );
  }
  return withActor(db, input.userId, async (tx) => {
    const open = await tx.$queryRaw<
      {
        id: string;
        state: string;
        requested_at: Date;
        policy_version: string | null;
      }[]
    >`
      SELECT id, state, requested_at, policy_version FROM account_deletion_requests
      WHERE user_id = ${input.userId}::uuid
        AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
      FOR UPDATE
    `;
    if (open[0]) {
      // Upgrade legacy AWAITING_POLICY rows once O06 is configured.
      if (
        open[0].state === 'AWAITING_POLICY' ||
        open[0].policy_version == null
      ) {
        await tx.$executeRaw`
          UPDATE account_deletion_requests
          SET state = 'REQUESTED',
              policy_version = ${O06_ACCOUNT_ANONYMIZE_POLICY_VERSION},
              updated_at = now()
          WHERE id = ${open[0].id}::uuid
        `;
      }
      return {
        requestId: open[0].id,
        state: 'REQUESTED' as const,
        requestedAt: open[0].requested_at.toISOString(),
        policyStatus: 'RESOLVED' as const,
        anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
      };
    }
    const requestId = randomUUID();
    const requestedAt = new Date();
    await tx.$executeRaw`
      INSERT INTO account_deletion_requests (
        id, user_id, state, requested_at, policy_version
      ) VALUES (
        ${requestId}::uuid, ${input.userId}::uuid, 'REQUESTED',
        ${requestedAt}::timestamptz, ${O06_ACCOUNT_ANONYMIZE_POLICY_VERSION}
      )
    `;
    return {
      requestId,
      state: 'REQUESTED' as const,
      requestedAt: requestedAt.toISOString(),
      policyStatus: 'RESOLVED' as const,
      anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
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
  anonymizeWithinDays: typeof O06_ACCOUNT_ANONYMIZE_MAX_DAYS;
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
      anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
    };
  });
}

export type DueAccountAnonymization = {
  request_id: string;
  user_id: string;
};

export async function listDueAccountAnonymizations(
  db: PrismaClient,
  limit = 50,
): Promise<DueAccountAnonymization[]> {
  const rows = await db.$queryRaw<
    { out_request_id: string; out_user_id: string }[]
  >`
    SELECT out_request_id, out_user_id
    FROM list_due_account_anonymizations(${limit}::integer)
  `;
  return rows.map((r) => ({
    request_id: r.out_request_id,
    user_id: r.out_user_id,
  }));
}

export type ApplyAccountAnonymizationResult = {
  request_id: string;
  user_id: string | null;
  applied: boolean;
};

export async function applyAccountAnonymization(
  db: PrismaClient,
  requestId: string,
): Promise<ApplyAccountAnonymizationResult> {
  const rows = await db.$queryRaw<
    { out_request_id: string; out_user_id: string | null; out_applied: boolean }[]
  >`
    SELECT out_request_id, out_user_id, out_applied
    FROM apply_account_anonymization(${requestId}::uuid)
  `;
  const row = rows[0];
  if (!row) {
    return { request_id: requestId, user_id: null, applied: false };
  }
  return {
    request_id: row.out_request_id,
    user_id: row.out_user_id,
    applied: row.out_applied,
  };
}

/** Worker entry: anonymize due REQUESTED deletions (O06 ≤30d). */
export async function processDueAccountAnonymizations(
  db: PrismaClient,
  limit = 50,
): Promise<{ scanned: number; applied: number }> {
  const rows = await listDueAccountAnonymizations(db, limit);
  let applied = 0;
  for (const row of rows) {
    const result = await applyAccountAnonymization(db, row.request_id);
    if (result.applied) applied += 1;
  }
  return { scanned: rows.length, applied };
}
