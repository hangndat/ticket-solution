import { type OnModuleDestroy } from '@nestjs/common';
import {
  cleanupExpiredImportFiles,
  collectWorkerDueJobSnapshot,
  createMinioObjectStore,
  readMinioEnvironment,
  readMinioImportsEnvironment,
  reconcileDuePendingRedemptions,
  processDueAccountAnonymizations,
  processDueTicketPiiAnonymizations,
  processDueObjectRetentions,
  relayExportsOnce,
  relayOutboxOnce,
  metricsInc,
  metricsObserveSeconds,
  metricsQuantileSeconds,
  metricsSetGauge,
  type ApnsAdapter,
  type EmailAdapter,
  type PrismaClient,
  type WorkerJobClass,
} from '@ticket/backend';
import { createTickGuard, waitForInflightTick } from './worker-tick-guard';
import {
  logWorkerShutdownWait,
  logWorkerDbDisconnectTimeout,
  logWorkerTickSkipped,
  logWorkerTickStepError,
  logWorkerTickStepStillRunning,
  logWorkerTickStepTimeout,
  type WorkerTickStep,
} from './worker-tick-log';
import {
  resolveTickStepTimeoutMs,
  runStepWithTimeout,
  TickStepTimeoutError,
} from './worker-tick-step-timeout';

export const DEFAULT_SHUTDOWN_TICK_TIMEOUT_MS = 30_000;
export { DEFAULT_TICK_STEP_TIMEOUT_MS } from './worker-tick-step-timeout';

export type WorkerRelayOptions = {
  shutdownTickTimeoutMs?: number;
  tickStepTimeoutMs?: number;
  /** Deterministic fault actions; only honored in NODE_ENV=test. */
  testActions?: Partial<Record<WorkerTickStep, () => Promise<unknown>>>;
};

const STEP_BUDGET_MS: Record<WorkerTickStep, number> = {
  reconcile_pending_redemptions: 5_000,
  relay_outbox: 20_000,
  process_account_anonymizations: 30_000,
  process_ticket_pii_anonymizations: 60_000,
  process_export_object_retentions: 60_000,
  relay_exports: 60_000,
  cleanup_import_files: 30_000,
};

const OLDEST_DUE_BUDGET_SECONDS: Record<WorkerJobClass, number> = {
  reconcile_pending_redemptions: 10,
  relay_outbox: 60,
  process_account_anonymizations: 15 * 60,
  process_ticket_pii_anonymizations: 60 * 60,
  process_export_object_retentions: 60 * 60,
  relay_exports: 5 * 60,
  cleanup_import_files: 30 * 60,
};

function hasDueWork(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const summary = result as { claimed?: unknown; scanned?: unknown };
  return (
    (typeof summary.claimed === 'number' && summary.claimed > 0) ||
    (typeof summary.scanned === 'number' && summary.scanned > 0)
  );
}

export class WorkerRelay implements OnModuleDestroy {
  private readonly timers: NodeJS.Timeout[] = [];
  private stopped = false;
  private consecutiveErrors = 0;
  private readonly tickGuard = createTickGuard(() => this.stopped);
  private readonly stepsInFlight = new Set<WorkerTickStep>();
  private readonly activeActions = new Set<Promise<unknown>>();
  private queueSnapshotInFlight: Promise<void> | null = null;
  private readonly laneGuards = {
    reconcile: createTickGuard(() => this.stopped),
    outbox: createTickGuard(() => this.stopped),
    maintenance: createTickGuard(() => this.stopped),
  };
  private readonly shutdownTickTimeoutMs: number;
  private readonly tickStepTimeoutMs: number;
  private readonly testActions?: WorkerRelayOptions['testActions'];

  constructor(
    private readonly db: PrismaClient | null,
    private readonly email: EmailAdapter,
    /** Undefined = APNs disabled (omit options.apns → skip push). Null = fail-closed. */
    private readonly apns: ApnsAdapter | null | undefined,
    private readonly leaseOwner: string,
    private readonly ownsDb: boolean,
    private readonly intervalMs: number,
    private readonly credentialKeyMaterial: string,
    private readonly env: NodeJS.ProcessEnv,
    options: WorkerRelayOptions = {},
  ) {
    this.shutdownTickTimeoutMs =
      options.shutdownTickTimeoutMs ?? DEFAULT_SHUTDOWN_TICK_TIMEOUT_MS;
    this.tickStepTimeoutMs = resolveTickStepTimeoutMs(
      env['WORKER_TICK_STEP_TIMEOUT_MS'],
      options.tickStepTimeoutMs,
    );
    this.testActions = options.testActions;
  }

  private relayOpts() {
    const base = {
      credentialKeyMaterial: this.credentialKeyMaterial,
      env: this.env,
    };
    if (this.apns !== undefined) {
      return { ...base, apns: this.apns };
    }
    return base;
  }

  private async step(
    name: WorkerTickStep,
    action: () => Promise<unknown>,
  ): Promise<void> {
    if (!this.db || this.stopped) return;
    if (this.stepsInFlight.has(name)) {
      logWorkerTickStepStillRunning(name);
      metricsInc('worker_job_skipped_total', { job_class: name });
      return;
    }

    const runAction = async () => {
      this.stepsInFlight.add(name);
      metricsSetGauge('worker_job_inflight', 1, { job_class: name });
      const started = performance.now();
      let active = false;
      try {
        const hangStep = this.env['WORKER_TEST_HANG_TICK_STEP'];
        if (
          this.env['NODE_ENV'] === 'test' &&
          typeof hangStep === 'string' &&
          hangStep === name
        ) {
          await new Promise<void>(() => {});
        }
        const testAction =
          this.env['NODE_ENV'] === 'test'
            ? this.testActions?.[name]
            : undefined;
        const result = await (testAction ?? action)();
        active = hasDueWork(result);
        return result;
      } finally {
        const durationSeconds = (performance.now() - started) / 1000;
        metricsObserveSeconds(
          'worker_job_duration_seconds',
          durationSeconds,
          { job_class: name },
        );
        if (active) {
          metricsObserveSeconds('worker_job_active_duration_seconds', durationSeconds, {
            job_class: name,
          });
        }
        metricsSetGauge('worker_job_inflight', 0, { job_class: name });
        this.stepsInFlight.delete(name);
      }
    };

    try {
      await runStepWithTimeout(
        name,
        Math.min(this.tickStepTimeoutMs, STEP_BUDGET_MS[name]),
        () => {
          const actionPromise = runAction();
          this.activeActions.add(actionPromise);
          void actionPromise
            .finally(() => this.activeActions.delete(actionPromise))
            .catch(() => {});
          return actionPromise;
        },
      );
      metricsInc('worker_job_runs_total', { job_class: name, result: 'ok' });
      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors += 1;
      if (error instanceof TickStepTimeoutError) {
        metricsInc('worker_job_runs_total', {
          job_class: name,
          result: 'timeout',
        });
        logWorkerTickStepTimeout(name, error.timeoutMs, this.consecutiveErrors);
        return;
      }
      metricsInc('worker_job_runs_total', {
        job_class: name,
        result: 'failed',
      });
      logWorkerTickStepError(name, error, this.consecutiveErrors);
    }
  }

  private async reconcile(): Promise<void> {
    await this.step('reconcile_pending_redemptions', () =>
      reconcileDuePendingRedemptions(this.db!, 50),
    );
  }

  private async outbox(): Promise<void> {
    // One claimed row per invocation stays inside the 30s outbox lease budget.
    await this.step('relay_outbox', () =>
      relayOutboxOnce(
        this.db!,
        this.email,
        this.leaseOwner,
        1,
        this.relayOpts(),
      ),
    );
  }

  private async maintenance(): Promise<void> {
    await this.step('process_account_anonymizations', () =>
      processDueAccountAnonymizations(this.db!, 10, {
        env: this.env,
        leaseOwner: this.leaseOwner,
      }),
    );
    await this.step('process_ticket_pii_anonymizations', () =>
      processDueTicketPiiAnonymizations(this.db!, 10),
    );
    const exportsConfig = readMinioEnvironment(this.env);
    if (exportsConfig) {
      await this.step('relay_exports', () =>
        relayExportsOnce(this.db!, this.env, this.leaseOwner, 1),
      );
      await this.step('process_export_object_retentions', () =>
        processDueObjectRetentions(
          this.db!,
          createMinioObjectStore(exportsConfig),
          this.leaseOwner,
          1,
        ),
      );
    }
    const importsCfg = readMinioImportsEnvironment(this.env);
    if (importsCfg) {
      await this.step('cleanup_import_files', () =>
        cleanupExpiredImportFiles(
          this.db!,
          createMinioObjectStore(importsCfg),
          20,
        ),
      );
    }
  }

  private async executeTick(): Promise<void> {
    if (!this.db) return;
    const testDelayMs = Number(this.env['WORKER_TEST_TICK_DELAY_MS']);
    if (
      this.env['NODE_ENV'] === 'test' &&
      Number.isFinite(testDelayMs) &&
      testDelayMs > 0
    ) {
      await new Promise((resolve) => setTimeout(resolve, testDelayMs));
    }
    await Promise.all([this.reconcile(), this.outbox(), this.maintenance()]);
  }

  private probeQueue(): void {
    if (!this.db || this.stopped || this.queueSnapshotInFlight) return;
    const probe = (async () => {
      try {
        const rows = await collectWorkerDueJobSnapshot(this.db!);
        console.info(
          JSON.stringify({
            level: 'info',
            component: 'worker',
            event: 'queue_snapshot',
            jobs: rows.map((row) => ({
              jobClass: row.jobClass,
              oldestDueAgeSeconds: Math.round(row.oldestDueAgeSeconds),
              dueCount: row.dueCount,
              reclaimCount: row.reclaimCount,
              p95DurationSeconds: metricsQuantileSeconds(
                'worker_job_duration_seconds',
                { job_class: row.jobClass },
                0.95,
              ),
            })),
            poolWaitP95Seconds: metricsQuantileSeconds(
              'worker_db_pool_wait_seconds',
              {},
              0.95,
            ),
          }),
        );
        for (const row of rows) {
          const labels = { job_class: row.jobClass };
          metricsSetGauge(
            'worker_job_oldest_due_age_seconds',
            row.oldestDueAgeSeconds,
            labels,
          );
          metricsSetGauge('worker_job_due_count', row.dueCount, labels);
          metricsSetGauge('worker_job_reclaim_total', row.reclaimCount, labels);
          if (
            row.dueCount > 0 &&
            row.oldestDueAgeSeconds > OLDEST_DUE_BUDGET_SECONDS[row.jobClass]
          ) {
            console.warn(
              JSON.stringify({
                level: 'warn',
                component: 'worker',
                event: 'job_due_age_budget_exceeded',
                jobClass: row.jobClass,
                oldestDueAgeSeconds: Math.round(row.oldestDueAgeSeconds),
                dueCount: row.dueCount,
                budgetSeconds: OLDEST_DUE_BUDGET_SECONDS[row.jobClass],
              }),
            );
          }
        }
      } catch {
        metricsInc('worker_queue_probe_failed_total');
        console.error(
          JSON.stringify({
            level: 'error',
            component: 'worker',
            event: 'queue_probe_failed',
          }),
        );
      }
    })();
    this.queueSnapshotInFlight = probe;
    void probe.finally(() => {
      this.queueSnapshotInFlight = null;
    });
  }

  /** Exposed for tests and manual drain. */
  async runPollCycle(): Promise<void> {
    const result = await this.tickGuard.run(() => this.executeTick());
    if (!result.ran && result.reason === 'reentrant') {
      logWorkerTickSkipped('reentrant');
    }
  }

  start() {
    if (!this.db || this.intervalMs <= 0 || this.timers.length > 0) return;
    // Three bounded lanes share one process and its existing five-connection DB pool.
    // A stalled provider or export cannot hold the reconcile timer.
    const lanes = [
      ['reconcile', () => this.reconcile()],
      ['outbox', () => this.outbox()],
      ['maintenance', () => this.maintenance()],
    ] as const;
    for (const [name, body] of lanes) {
      const poll = () => {
        void this.laneGuards[name].run(body).catch(() => {});
      };
      poll();
      this.timers.push(setInterval(poll, this.intervalMs));
    }
    this.probeQueue();
    this.timers.push(setInterval(() => this.probeQueue(), 10_000));
  }

  async relayOnce() {
    if (!this.db) return { claimed: 0, completed: 0, failed: 0 };
    await processDueAccountAnonymizations(this.db, 10, {
      env: this.env,
      leaseOwner: this.leaseOwner,
    });
    await processDueTicketPiiAnonymizations(this.db, 10);
    const outbox = await relayOutboxOnce(
      this.db,
      this.email,
      this.leaseOwner,
      1,
      this.relayOpts(),
    );
    const exportsConfig = readMinioEnvironment(this.env);
    if (exportsConfig) {
      await relayExportsOnce(this.db, this.env, this.leaseOwner, 1);
      await processDueObjectRetentions(
        this.db,
        createMinioObjectStore(exportsConfig),
        this.leaseOwner,
        1,
      );
    }
    return outbox;
  }

  isTickInFlight(): boolean {
    return this.tickGuard.isTickInFlight();
  }

  async onModuleDestroy() {
    this.stopped = true;
    for (const timer of this.timers) clearInterval(timer);
    const shutdownDeadline = performance.now() + this.shutdownTickTimeoutMs;
    const waitOutcome = await waitForInflightTick(() => {
      const active = [
        this.tickGuard.getInflightTick(),
        ...Object.values(this.laneGuards).map((guard) =>
          guard.getInflightTick(),
        ),
        ...this.activeActions,
        this.queueSnapshotInFlight,
      ].filter((promise): promise is Promise<unknown> => promise !== null);
      return active.length > 0
        ? Promise.allSettled(active).then(() => {})
        : null;
    }, this.shutdownTickTimeoutMs);
    logWorkerShutdownWait(waitOutcome, this.shutdownTickTimeoutMs);
    if (this.ownsDb && this.db) {
      const remainingMs = Math.max(1, Math.floor(shutdownDeadline - performance.now()));
      try {
        await runStepWithTimeout(
          'db_disconnect',
          remainingMs,
          () => this.db!.$disconnect(),
        );
      } catch (error) {
        if (error instanceof TickStepTimeoutError) {
          logWorkerDbDisconnectTimeout(this.shutdownTickTimeoutMs);
        } else {
          throw error;
        }
      }
    }
  }
}
