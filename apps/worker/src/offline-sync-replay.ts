/**
 * D7-S1-T3 — Worker-safe offline queue replay.
 *
 * Same durable apply as API `POST …/offline-sync` (ADR-18). Callers pass an
 * already-authenticated actor + tenant id. Does not open HTTP; intended for
 * ops/tests and future internal relays.
 */

import {
  applyOfflineSyncBatch,
  withTenant,
  type ApplyOfflineSyncInput,
  type PrismaClient,
} from '@ticket/backend';

export type ReplayOfflineSyncBatchInput = ApplyOfflineSyncInput & {
  db: PrismaClient;
  tenantId: string;
};

/**
 * Replay one offline sync batch under tenant RLS. Idempotent per clientEventId.
 */
export async function replayOfflineSyncBatch(
  input: ReplayOfflineSyncBatchInput,
): Promise<Awaited<ReturnType<typeof applyOfflineSyncBatch>>> {
  const { db, tenantId, ...applyInput } = input;
  return withTenant(db, tenantId, (tx) =>
    applyOfflineSyncBatch(tx, applyInput),
  );
}

export { applyOfflineSyncBatch };
