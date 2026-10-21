import { type OnModuleDestroy } from '@nestjs/common';
import {
  cleanupExpiredImportFiles,
  createMinioObjectStore,
  readMinioEnvironment,
  readMinioImportsEnvironment,
  reconcileDuePendingRedemptions,
  processDueAccountAnonymizations,
  relayExportsOnce,
  relayOutboxOnce,
  type ApnsAdapter,
  type EmailAdapter,
  type PrismaClient,
} from '@ticket/backend';
import {
  createTickGuard,
  waitForInflightTick,
} from './worker-tick-guard';
import {
  logWorkerShutdownWait,
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
};

export class WorkerRelay implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private consecutiveErrors = 0;
  private readonly tickGuard = createTickGuard(() => this.stopped);
  private readonly stepsInFlight = new Set<WorkerTickStep>();
  private readonly shutdownTickTimeoutMs: number;
  private readonly tickStepTimeoutMs: number;

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

    let errorsThisTick = 0;
    const step = async (
      name: WorkerTickStep,
      action: () => Promise<unknown>,
    ): Promise<void> => {
      if (this.stepsInFlight.has(name)) {
        logWorkerTickStepStillRunning(name);
        return;
      }

      const runAction = async () => {
        this.stepsInFlight.add(name);
        try {
          const hangStep = this.env['WORKER_TEST_HANG_TICK_STEP'];
          if (
            this.env['NODE_ENV'] === 'test' &&
            typeof hangStep === 'string' &&
            hangStep === name
          ) {
            await new Promise<void>(() => {});
          }
          return await action();
        } finally {
          this.stepsInFlight.delete(name);
        }
      };

      try {
        await runStepWithTimeout(
          name,
          this.tickStepTimeoutMs,
          runAction,
        );
      } catch (error) {
        errorsThisTick += 1;
        this.consecutiveErrors += 1;
        if (error instanceof TickStepTimeoutError) {
          logWorkerTickStepTimeout(
            name,
            error.timeoutMs,
            this.consecutiveErrors,
          );
          return;
        }
        logWorkerTickStepError(name, error, this.consecutiveErrors);
      }
    };

    await step('reconcile_pending_redemptions', () =>
      reconcileDuePendingRedemptions(this.db!, 50),
    );
    await step('process_account_anonymizations', () =>
      processDueAccountAnonymizations(this.db!, 50, {
        env: this.env,
        leaseOwner: this.leaseOwner,
      }),
    );
    await step('relay_outbox', () =>
      relayOutboxOnce(
        this.db!,
        this.email,
        this.leaseOwner,
        10,
        this.relayOpts(),
      ),
    );
    if (readMinioEnvironment(this.env)) {
      await step('relay_exports', () =>
        relayExportsOnce(this.db!, this.env, this.leaseOwner, 5),
      );
    }
    const importsCfg = readMinioImportsEnvironment(this.env);
    if (importsCfg) {
      await step('cleanup_import_files', () =>
        cleanupExpiredImportFiles(
          this.db!,
          createMinioObjectStore(importsCfg),
          20,
        ),
      );
    }

    if (errorsThisTick === 0 && this.consecutiveErrors > 0) {
      this.consecutiveErrors = 0;
    }
  }

  /** Exposed for tests and manual drain. */
  async runPollCycle(): Promise<void> {
    const result = await this.tickGuard.run(() => this.executeTick());
    if (!result.ran && result.reason === 'reentrant') {
      logWorkerTickSkipped('reentrant');
    }
  }

  start() {
    if (!this.db || this.intervalMs <= 0) return;
    void this.runPollCycle();
    this.timer = setInterval(() => void this.runPollCycle(), this.intervalMs);
  }

  async relayOnce() {
    if (!this.db) return { claimed: 0, completed: 0, failed: 0 };
    await processDueAccountAnonymizations(this.db, 50, {
      env: this.env,
      leaseOwner: this.leaseOwner,
    });
    const outbox = await relayOutboxOnce(
      this.db,
      this.email,
      this.leaseOwner,
      10,
      this.relayOpts(),
    );
    if (readMinioEnvironment(this.env)) {
      await relayExportsOnce(this.db, this.env, this.leaseOwner, 5);
    }
    return outbox;
  }

  isTickInFlight(): boolean {
    return this.tickGuard.isTickInFlight();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    const waitOutcome = await waitForInflightTick(
      () => this.tickGuard.getInflightTick(),
      this.shutdownTickTimeoutMs,
    );
    logWorkerShutdownWait(waitOutcome, this.shutdownTickTimeoutMs);
    if (this.ownsDb && this.db) await this.db.$disconnect();
  }
}
