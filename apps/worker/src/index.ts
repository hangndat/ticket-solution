import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Module, type OnModuleDestroy } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  createApnsAdapter,
  createDatabase,
  createSmtpEmailAdapter,
  isApnsEnabled,
  readCredentialKeyEnvironment,
  readEmailEnvironment,
  readMinioEnvironment,
  readProcessEnvironment,
  reconcileDuePendingRedemptions,
  relayExportsOnce,
  relayOutboxOnce,
  type ApnsAdapter,
  type EmailAdapter,
  type PrismaClient,
} from '@ticket/backend';

export {
  replayOfflineSyncBatch,
  applyOfflineSyncBatch,
  type ReplayOfflineSyncBatchInput,
} from './offline-sync-replay';

export type CreateWorkerOptions = {
  env?: NodeJS.ProcessEnv;
  logging?: boolean;
  database?: PrismaClient;
  emailAdapter?: EmailAdapter;
  apnsAdapter?: ApnsAdapter;
  relayOnceOnStart?: boolean;
  leaseOwner?: string;
  /** Poll interval; 0 disables background polling. */
  pollMs?: number;
};

class WorkerRelay implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

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
  ) {}

  private relayOpts() {
    const base = {
      credentialKeyMaterial: this.credentialKeyMaterial,
      env: this.env,
    };
    // Only opt into APNs when enabled (or test injects adapter/null).
    if (this.apns !== undefined) {
      return { ...base, apns: this.apns };
    }
    return base;
  }

  start() {
    if (!this.db || this.intervalMs <= 0) return;
    const tick = async () => {
      if (this.stopped || !this.db) return;
      try {
        await reconcileDuePendingRedemptions(this.db, 50);
      } catch {
        // Keep looping; pending expiry is lazy-reconciled on read/decide too.
      }
      try {
        await relayOutboxOnce(
          this.db,
          this.email,
          this.leaseOwner,
          10,
          this.relayOpts(),
        );
      } catch {
        // Keep looping; outbox remains source of truth.
      }
      if (readMinioEnvironment(this.env)) {
        try {
          await relayExportsOnce(this.db, this.env, this.leaseOwner, 5);
        } catch {
          // Export jobs stay PENDING/PROCESSING until success.
        }
      }
    };
    void tick();
    this.timer = setInterval(() => void tick(), this.intervalMs);
  }

  async relayOnce() {
    if (!this.db) return { claimed: 0, completed: 0, failed: 0 };
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

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.ownsDb && this.db) await this.db.$disconnect();
  }
}

function isOptionsObject(value: unknown): value is CreateWorkerOptions {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'database' in value ||
    'emailAdapter' in value ||
    'apnsAdapter' in value ||
    'relayOnceOnStart' in value ||
    'leaseOwner' in value ||
    'pollMs' in value ||
    'env' in value ||
    ('logging' in value && !('PATH' in value))
  );
}

/** @deprecated Prefer createWorker({ env, logging }). Kept for W0 main.ts. */
export async function createWorker(
  envOrOptions: NodeJS.ProcessEnv | CreateWorkerOptions = process.env,
  logging = true,
) {
  const options: CreateWorkerOptions = isOptionsObject(envOrOptions)
    ? { logging, ...envOrOptions }
    : { env: envOrOptions as NodeJS.ProcessEnv, logging };

  const env = options.env ?? process.env;
  readProcessEnvironment(env);

  let db = options.database ?? null;
  let ownsDb = false;
  if (!db && env['DATABASE_URL']?.trim()) {
    db = createDatabase(env['DATABASE_URL']);
    ownsDb = true;
  }

  const email =
    options.emailAdapter ??
    createSmtpEmailAdapter(readEmailEnvironment(env));
  // APNS_ENABLED=false → omit adapter (skip push). Enabled without key → fail-closed at construct.
  const apns: ApnsAdapter | null | undefined =
    options.apnsAdapter !== undefined
      ? options.apnsAdapter
      : isApnsEnabled(env)
        ? createApnsAdapter(env)
        : undefined;
  const leaseOwner = options.leaseOwner ?? `worker-${randomUUID()}`;
  const intervalMs =
    options.pollMs ??
    (Number.isFinite(Number(env['OUTBOX_POLL_MS']))
      ? Number(env['OUTBOX_POLL_MS'])
      : 2000);
  let credentialKeyMaterial = '';
  try {
    credentialKeyMaterial = readCredentialKeyEnvironment(env);
  } catch {
    // Misconfigured key → relay marks FAILED/retry; tickets remain committed.
  }

  const relay = new WorkerRelay(
    db,
    email,
    apns,
    leaseOwner,
    ownsDb,
    intervalMs,
    credentialKeyMaterial,
    env,
  );

  @Module({
    providers: [{ provide: WorkerRelay, useValue: relay }],
  })
  class WorkerModule {}

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: (options.logging ?? true) ? undefined : false,
  });
  app.enableShutdownHooks();

  if (options.relayOnceOnStart) {
    await relay.relayOnce();
  } else {
    relay.start();
  }

  return Object.assign(app, { relay });
}
