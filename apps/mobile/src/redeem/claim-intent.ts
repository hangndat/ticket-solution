import type { SessionEpoch } from '../identity/session-boundary.ts';
import type { FormAnswerValue } from './contract.ts';

/**
 * Guest invitation claim login-return intent (C-I).
 * Token is held in memory only — never logged / analytics / SecureStore dump.
 * Cleared on logout, account switch, or successful claim.
 */

export type GuestClaimIntent = {
  /** Opaque claim token — do not log. */
  token: string;
  tenantId: string;
  eventId: string;
  /** Optional published slugs for form/terms reload after login. */
  tenantSlug?: string;
  eventSlug?: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
  /** User who parked the intent (null = pre-login). */
  parkedUserId: string | null;
  /** Epoch generation when parked under a verified session; null if signed-out park. */
  parkedGeneration: number | null;
  createdAt: number;
};

let activeIntent: GuestClaimIntent | null = null;

export function peekGuestClaimIntent(): GuestClaimIntent | null {
  return activeIntent;
}

export function clearGuestClaimIntent(): void {
  activeIntent = null;
}

export function parkGuestClaimIntent(
  intent: Omit<GuestClaimIntent, 'createdAt'>,
): GuestClaimIntent {
  const next: GuestClaimIntent = { ...intent, createdAt: Date.now() };
  activeIntent = next;
  return next;
}

export type ClaimIntentResume =
  | { ok: true; intent: GuestClaimIntent }
  | {
      ok: false;
      reason:
        | 'none'
        | 'epoch-stale'
        | 'user-mismatch'
        | 'missing-scope'
        | 'missing-token';
    };

/**
 * Resume after login/return only when the current verified epoch still owns
 * the parked intent (or it was parked while signed out).
 */
export function resumeGuestClaimIntent(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): ClaimIntentResume {
  const intent = activeIntent;
  if (!intent) return { ok: false, reason: 'none' };
  if (!intent.token.trim()) {
    clearGuestClaimIntent();
    return { ok: false, reason: 'missing-token' };
  }
  if (!intent.tenantId.trim() || !intent.eventId.trim()) {
    clearGuestClaimIntent();
    return { ok: false, reason: 'missing-scope' };
  }

  // Parked under a verified user — require same user + live generation.
  if (intent.parkedUserId !== null) {
    if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
      clearGuestClaimIntent();
      return { ok: false, reason: 'user-mismatch' };
    }
    if (
      intent.parkedGeneration !== null &&
      intent.parkedGeneration !== input.epoch.generation
    ) {
      clearGuestClaimIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    if (!input.isEpochCurrent(input.epoch)) {
      clearGuestClaimIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    return { ok: true, intent };
  }

  // Pre-login park: require a current verified epoch to claim.
  if (!input.epoch || !input.isEpochCurrent(input.epoch)) {
    return { ok: false, reason: 'epoch-stale' };
  }
  return { ok: true, intent };
}

/** Drop intent when the verified identity flips or logs out. */
export function dropGuestClaimIntentIfStale(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): void {
  const intent = activeIntent;
  if (!intent) return;
  if (intent.parkedUserId === null) {
    // Signed-out park survives until resume or explicit clear — but drop if
    // a different verified user starts without consuming (caller clears on switch).
    return;
  }
  if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
    clearGuestClaimIntent();
    return;
  }
  if (
    intent.parkedGeneration !== null &&
    intent.parkedGeneration !== input.epoch.generation
  ) {
    clearGuestClaimIntent();
  }
}

/** Redacted debug view — never includes token. */
export function redactGuestClaimIntent(
  intent: GuestClaimIntent | null,
): Record<string, unknown> | null {
  if (!intent) return null;
  return {
    tenantId: intent.tenantId,
    eventId: intent.eventId,
    tenantSlug: intent.tenantSlug ?? null,
    eventSlug: intent.eventSlug ?? null,
    formVersion: intent.formVersion ?? null,
    termsVersion: intent.termsVersion ?? null,
    hasAnswers: Boolean(intent.answers && Object.keys(intent.answers).length),
    termsAccepted: intent.termsAccepted === true,
    parkedUserId: intent.parkedUserId,
    parkedGeneration: intent.parkedGeneration,
    hasToken: intent.token.length > 0,
    tokenLength: intent.token.length,
  };
}
