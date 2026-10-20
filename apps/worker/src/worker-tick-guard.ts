export type TickGuardSkipReason = 'stopped' | 'reentrant';

export type TickGuardResult =
  | { ran: true }
  | { ran: false; reason: TickGuardSkipReason };

/**
 * Ensures at most one async tick body runs at a time (interval may fire while tick is in flight).
 */
export function createTickGuard(isStopped: () => boolean) {
  let inFlight = false;
  let inflightPromise: Promise<void> | null = null;

  async function run(body: () => Promise<void>): Promise<TickGuardResult> {
    if (isStopped()) return { ran: false, reason: 'stopped' };
    if (inFlight) return { ran: false, reason: 'reentrant' };

    inFlight = true;
    const runPromise = (async () => {
      try {
        await body();
      } finally {
        inFlight = false;
        inflightPromise = null;
      }
    })();
    inflightPromise = runPromise;
    await runPromise;
    return { ran: true };
  }

  function getInflightTick(): Promise<void> | null {
    return inflightPromise;
  }

  function isTickInFlight(): boolean {
    return inFlight;
  }

  return { run, getInflightTick, isTickInFlight };
}

export async function waitForInflightTick(
  getInflight: () => Promise<void> | null,
  timeoutMs: number,
): Promise<'completed' | 'timed_out' | 'none'> {
  const inflight = getInflight();
  if (!inflight) return 'none';
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timed_out'>((resolve) => {
    timer = setTimeout(() => resolve('timed_out'), timeoutMs);
  });
  const result = await Promise.race([
    inflight.then(() => 'completed' as const),
    timeout,
  ]);
  if (timer) clearTimeout(timer);
  return result;
}
