import type { SessionEpoch } from '../identity/session-boundary.ts';
import type { FormAnswerValue } from './contract.ts';

/**
 * Redeem form draft for login-return (memory only — code/answers never in URL).
 * Cleared on logout or successful redeem submit.
 */

export type RedeemDraftIntent = {
  tenantId: string;
  eventId: string;
  tenantSlug: string;
  eventSlug: string;
  code: string;
  answers: Record<string, FormAnswerValue>;
  termsAccepted: boolean;
  formVersion?: string;
  termsVersion?: string;
  parkedUserId: string | null;
  parkedGeneration: number | null;
  createdAt: number;
};

let activeDraft: RedeemDraftIntent | null = null;

export function peekRedeemDraftIntent(): RedeemDraftIntent | null {
  return activeDraft;
}

export function clearRedeemDraftIntent(): void {
  activeDraft = null;
}

export function parkRedeemDraftIntent(
  intent: Omit<RedeemDraftIntent, 'createdAt'>,
): RedeemDraftIntent {
  const next: RedeemDraftIntent = { ...intent, createdAt: Date.now() };
  activeDraft = next;
  return next;
}

export type RedeemDraftResume =
  | { ok: true; intent: RedeemDraftIntent }
  | {
      ok: false;
      reason: 'none' | 'epoch-stale' | 'user-mismatch';
    };

export function resumeRedeemDraftIntent(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): RedeemDraftResume {
  const intent = activeDraft;
  if (!intent) return { ok: false, reason: 'none' };

  if (intent.parkedUserId !== null) {
    if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
      clearRedeemDraftIntent();
      return { ok: false, reason: 'user-mismatch' };
    }
    if (
      intent.parkedGeneration !== null &&
      intent.parkedGeneration !== input.epoch.generation
    ) {
      clearRedeemDraftIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    if (!input.isEpochCurrent(input.epoch)) {
      clearRedeemDraftIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    return { ok: true, intent };
  }

  if (!input.epoch || !input.isEpochCurrent(input.epoch)) {
    return { ok: false, reason: 'epoch-stale' };
  }
  return { ok: true, intent };
}

/** Drop draft when the verified identity flips or logs out. */
export function dropRedeemDraftIntentIfStale(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): void {
  const intent = activeDraft;
  if (!intent) return;
  if (intent.parkedUserId === null) {
    return;
  }
  if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
    clearRedeemDraftIntent();
    return;
  }
  if (
    intent.parkedGeneration !== null &&
    intent.parkedGeneration !== input.epoch.generation
  ) {
    clearRedeemDraftIntent();
  }
}

/** Redacted debug view — never includes redeem code. */
export function redactRedeemDraftIntent(
  intent: RedeemDraftIntent | null,
): Record<string, unknown> | null {
  if (!intent) return null;
  return {
    tenantId: intent.tenantId,
    eventId: intent.eventId,
    tenantSlug: intent.tenantSlug,
    eventSlug: intent.eventSlug,
    formVersion: intent.formVersion ?? null,
    termsVersion: intent.termsVersion ?? null,
    hasAnswers: Boolean(
      intent.answers && Object.keys(intent.answers).length > 0,
    ),
    termsAccepted: intent.termsAccepted === true,
    parkedUserId: intent.parkedUserId,
    parkedGeneration: intent.parkedGeneration,
    hasCode: intent.code.length > 0,
    codeLength: intent.code.length,
  };
}
