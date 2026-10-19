import type { SessionEpoch } from '../identity/session-boundary.ts';

/**
 * Global single-code redeem: park plaintext code in memory only (no URL/deep link).
 * Cleared on logout, account switch, or successful issue.
 */

export type GlobalRedeemDraftIntent = {
  /** Redemption code — never log. */
  code: string;
  parkedUserId: string | null;
  parkedGeneration: number | null;
  createdAt: number;
};

let activeIntent: GlobalRedeemDraftIntent | null = null;

export function peekGlobalRedeemDraftIntent(): GlobalRedeemDraftIntent | null {
  return activeIntent;
}

export function clearGlobalRedeemDraftIntent(): void {
  activeIntent = null;
}

export function parkGlobalRedeemDraftIntent(
  intent: Omit<GlobalRedeemDraftIntent, 'createdAt'>,
): GlobalRedeemDraftIntent {
  const next: GlobalRedeemDraftIntent = { ...intent, createdAt: Date.now() };
  activeIntent = next;
  return next;
}

export type RedeemDraftResume =
  | { ok: true; intent: GlobalRedeemDraftIntent }
  | {
      ok: false;
      reason:
        | 'none'
        | 'epoch-stale'
        | 'user-mismatch'
        | 'missing-code';
    };

export function resumeGlobalRedeemDraftIntent(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): RedeemDraftResume {
  const intent = activeIntent;
  if (!intent) return { ok: false, reason: 'none' };
  if (!intent.code.trim()) {
    clearGlobalRedeemDraftIntent();
    return { ok: false, reason: 'missing-code' };
  }

  if (intent.parkedUserId !== null) {
    if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
      clearGlobalRedeemDraftIntent();
      return { ok: false, reason: 'user-mismatch' };
    }
    if (
      intent.parkedGeneration !== null &&
      intent.parkedGeneration !== input.epoch.generation
    ) {
      clearGlobalRedeemDraftIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    if (!input.isEpochCurrent(input.epoch)) {
      clearGlobalRedeemDraftIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    return { ok: true, intent };
  }

  if (!input.epoch || !input.isEpochCurrent(input.epoch)) {
    return { ok: false, reason: 'epoch-stale' };
  }
  return { ok: true, intent };
}

export function dropGlobalRedeemDraftIntentIfStale(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): void {
  const intent = activeIntent;
  if (!intent) return;
  if (intent.parkedUserId === null) return;
  if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
    clearGlobalRedeemDraftIntent();
    return;
  }
  if (
    intent.parkedGeneration !== null &&
    intent.parkedGeneration !== input.epoch.generation
  ) {
    clearGlobalRedeemDraftIntent();
  }
}

/** Redacted debug view — never includes code plaintext. */
export function redactGlobalRedeemDraftIntent(
  intent: GlobalRedeemDraftIntent | null,
): Record<string, unknown> | null {
  if (!intent) return null;
  return {
    parkedUserId: intent.parkedUserId,
    parkedGeneration: intent.parkedGeneration,
    hasCode: intent.code.length > 0,
    codeLength: intent.code.length,
  };
}
