export type WorkerTickStep =
  | 'reconcile_pending_redemptions'
  | 'process_account_anonymizations'
  | 'relay_outbox'
  | 'relay_exports'
  | 'cleanup_import_files';

const MAX_LOG_MESSAGE_LEN = 500;

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= MAX_LOG_MESSAGE_LEN) return trimmed;
  return `${trimmed.slice(0, MAX_LOG_MESSAGE_LEN)}…`;
}

export function logWorkerTickStepTimeout(
  step: WorkerTickStep,
  timeoutMs: number,
  consecutiveErrors: number,
): void {
  console.error(
    JSON.stringify({
      level: 'error',
      component: 'worker',
      event: 'tick_step_timeout',
      step,
      timeoutMs,
      consecutiveErrors,
    }),
  );
}

export function logWorkerTickStepError(
  step: WorkerTickStep,
  _error: unknown,
  consecutiveErrors: number,
): void {
  console.error(
    JSON.stringify({
      level: 'error',
      component: 'worker',
      event: 'tick_step_failed',
      step,
      code: 'STEP_FAILED',
      consecutiveErrors,
    }),
  );
}

export function logWorkerTickStepStillRunning(step: WorkerTickStep): void {
  console.warn(
    JSON.stringify({
      level: 'warn',
      component: 'worker',
      event: 'tick_step_still_running',
      step,
    }),
  );
}

export function logWorkerTickSkipped(reason: 'reentrant'): void {
  console.warn(
    JSON.stringify({
      level: 'warn',
      component: 'worker',
      event: 'tick_skipped',
      reason,
    }),
  );
}

export function logCredentialKeyMisconfigured(message: string): void {
  console.warn(
    JSON.stringify({
      level: 'warn',
      component: 'worker',
      event: 'credential_key_misconfigured',
      message: safeMessage(message),
    }),
  );
}

export function logWorkerShutdownWait(
  outcome: 'completed' | 'timed_out' | 'none',
  timeoutMs: number,
): void {
  console.info(
    JSON.stringify({
      level: 'info',
      component: 'worker',
      event: 'shutdown_tick_wait',
      outcome,
      timeoutMs,
    }),
  );
}
