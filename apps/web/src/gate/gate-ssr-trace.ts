/** Env-gated SSR timing for /gate (Issue #1021). Set GATE_SSR_TRACE=1 — logs step names + ms only. */
export function gateSsrTraceEnabled(): boolean {
  return process.env.GATE_SSR_TRACE === '1';
}

export type GateSsrTrace = {
  mark: (step: string) => void;
  finish: (note?: string) => void;
};

export function createGateSsrTrace(root: string): GateSsrTrace {
  const t0 = Date.now();
  return {
    mark(step: string) {
      if (!gateSsrTraceEnabled()) return;
      const ms = Date.now() - t0;
      console.info(`[gate-ssr-trace] ${root} ${step} +${ms}ms`);
    },
    finish(note?: string) {
      if (!gateSsrTraceEnabled()) return;
      const ms = Date.now() - t0;
      const suffix = note ? ` ${note}` : '';
      console.info(`[gate-ssr-trace] ${root} done total=${ms}ms${suffix}`);
    },
  };
}
