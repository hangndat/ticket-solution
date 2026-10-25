import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  createApnsAdapter,
  createDatabase,
  createSmtpEmailAdapter,
  isApnsEnabled,
  readCredentialKeyEnvironment,
  readEmailEnvironment,
  readProcessEnvironment,
  type ApnsAdapter,
  type EmailAdapter,
  type PrismaClient,
} from '@ticket/backend';
import { WorkerRelay } from './worker-relay';
import { logCredentialKeyMisconfigured } from './worker-tick-log';

export {
  replayOfflineSyncBatch,
  applyOfflineSyncBatch,
  type ReplayOfflineSyncBatchInput,
} from './offline-sync-replay';

export {
  WorkerRelay,
  DEFAULT_SHUTDOWN_TICK_TIMEOUT_MS,
  DEFAULT_TICK_STEP_TIMEOUT_MS,
} from './worker-relay';
export {
  resolveTickStepTimeoutMs,
  runStepWithTimeout,
  TickStepTimeoutError,
} from './worker-tick-step-timeout';
export {
  createTickGuard,
  waitForInflightTick,
  type TickGuardResult,
} from './worker-tick-guard';

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
  /** Max wait for an in-flight poll cycle during shutdown (ms). */
  shutdownTickTimeoutMs?: number;
  /** Max wait per tick step before logging timeout and continuing (ms). */
  tickStepTimeoutMs?: number;
};

function isOptionsObject(value: unknown): value is CreateWorkerOptions {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'database' in value ||
    'emailAdapter' in value ||
    'apnsAdapter' in value ||
    'relayOnceOnStart' in value ||
    'leaseOwner' in value ||
    'pollMs' in value ||
    'shutdownTickTimeoutMs' in value ||
    'tickStepTimeoutMs' in value ||
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
  const apnsEnabled = isApnsEnabled(env);

  let db = options.database ?? null;
  let ownsDb = false;
  if (!db && env['DATABASE_URL']?.trim()) {
    db = createDatabase(env['DATABASE_URL']);
    ownsDb = true;
  }

  const email =
    options.emailAdapter ??
    createSmtpEmailAdapter(readEmailEnvironment(env));
  const apns: ApnsAdapter | null | undefined =
    options.apnsAdapter !== undefined
      ? options.apnsAdapter
      : apnsEnabled
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
  } catch (error) {
    logCredentialKeyMisconfigured(
      error instanceof Error ? error.message : 'TICKET_CREDENTIAL_KEY invalid',
    );
  }

  const shutdownFromEnv = Number(env['WORKER_SHUTDOWN_TICK_TIMEOUT_MS']);
  const shutdownTickTimeoutMs =
    options.shutdownTickTimeoutMs ??
    (Number.isFinite(shutdownFromEnv) && shutdownFromEnv > 0
      ? shutdownFromEnv
      : undefined);

  const tickStepTimeoutMs = options.tickStepTimeoutMs;

  const relay = new WorkerRelay(
    db,
    email,
    apns,
    leaseOwner,
    ownsDb,
    intervalMs,
    credentialKeyMaterial,
    env,
    { shutdownTickTimeoutMs, tickStepTimeoutMs },
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
