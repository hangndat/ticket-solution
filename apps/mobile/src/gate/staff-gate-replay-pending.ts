import type { GateOp } from './gate-scan.ts';
import { needsStickyPendingOp } from './staff-gate-scan-feedback.ts';

/** Pending chip after offline replay merges queue rows into persisted ops. */
export function resolvePendingOpAfterOfflineReplay(input: {
  currentPending: GateOp | null;
  currentOps: readonly GateOp[];
  nextOps: readonly GateOp[];
  activeSession: string;
}): GateOp | null {
  const { currentPending, currentOps, nextOps, activeSession } = input;
  let resolved: GateOp | null = null;
  if (currentPending) {
    if (currentPending.staffSessionId !== activeSession) return currentPending;
    resolved =
      nextOps.find(
        (op) =>
          op.id === currentPending.id &&
          op.clientEventId === currentPending.clientEventId,
      ) ?? currentPending;
  } else {
    resolved =
      nextOps.find(
        (op, index) =>
          op.staffSessionId === activeSession &&
          op !== currentOps[index] &&
          currentOps[index]?.phase === 'queued',
      ) ?? null;
  }
  if (resolved && !needsStickyPendingOp(resolved)) return null;
  return resolved;
}

/** First op that moved from queued to a terminal phase after replay reconcile. */
export function findTerminalReplayFeedbackOp(
  currentOps: readonly GateOp[],
  nextOps: readonly GateOp[],
): GateOp | undefined {
  return nextOps.find((op, index) => {
    const prior = currentOps[index];
    return (
      prior &&
      prior.phase === 'queued' &&
      op !== prior &&
      (op.phase === 'admitted' ||
        op.phase === 'recorded' ||
        op.phase === 'denied' ||
        op.phase === 'unknown')
    );
  });
}
