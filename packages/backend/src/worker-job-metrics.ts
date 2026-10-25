import type { PrismaClient } from './generated/prisma/client';

export const WORKER_JOB_CLASSES = [
  'reconcile_pending_redemptions',
  'relay_outbox',
  'process_account_anonymizations',
  'relay_exports',
  'cleanup_import_files',
] as const;

export type WorkerJobClass = (typeof WORKER_JOB_CLASSES)[number];
export type WorkerDueJobSnapshot = {
  jobClass: WorkerJobClass;
  oldestDueAgeSeconds: number;
  dueCount: number;
  reclaimCount: number;
};

/** SECURITY DEFINER returns aggregates only; never row or tenant identifiers. */
export async function collectWorkerDueJobSnapshot(
  db: PrismaClient,
): Promise<WorkerDueJobSnapshot[]> {
  const rows = await db.$queryRaw<
    {
      job_class: string;
      oldest_due_age_seconds: number;
      due_count: number;
      reclaim_count: bigint;
    }[]
  >`SELECT job_class, oldest_due_age_seconds, due_count, reclaim_count
       FROM public.worker_due_job_snapshot()`;
  const allowed = new Set<string>(WORKER_JOB_CLASSES);
  return rows
    .filter((row) => allowed.has(row.job_class))
    .map((row) => ({
      jobClass: row.job_class as WorkerJobClass,
      oldestDueAgeSeconds: Math.max(0, Number(row.oldest_due_age_seconds)),
      dueCount: Number(row.due_count),
      reclaimCount: Number(row.reclaim_count),
    }));
}
