/** Default per-step tick timeout (ms) — relay batches may run longer than one poll interval. */
export const DEFAULT_TICK_STEP_TIMEOUT_MS = 120_000;

/** Resolves per-step timeout from option override, then env, then default 120s. */
export function resolveTickStepTimeoutMs(
  envValue: string | undefined,
  optionMs?: number,
): number {
  if (
    optionMs !== undefined &&
    Number.isFinite(optionMs) &&
    optionMs > 0
  ) {
    return optionMs;
  }
  const fromEnv = Number(envValue);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_TICK_STEP_TIMEOUT_MS;
}

export class TickStepTimeoutError extends Error {
  readonly step: string;
  readonly timeoutMs: number;

  constructor(step: string, timeoutMs: number) {
    super(`tick step timed out: ${step}`);
    this.name = 'TickStepTimeoutError';
    this.step = step;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Awaits `action` up to `timeoutMs`. On timeout, rejects with {@link TickStepTimeoutError};
 * the underlying promise may still run (not cancelled).
 */
export function runStepWithTimeout<T>(
  step: string,
  timeoutMs: number,
  action: () => Promise<T>,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return action();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TickStepTimeoutError(step, timeoutMs));
    }, timeoutMs);

    void action().then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
