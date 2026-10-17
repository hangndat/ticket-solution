import type { FormAnswerValue } from '@ticket/contracts';

export type RedeemAttemptPayload = {
  tenantId: string;
  eventId: string;
  code: string;
  formVersion: string;
  termsVersion: string;
  answers: Record<string, FormAnswerValue>;
  termsAccepted: boolean;
};

export type RedeemAttempt = {
  key: string;
  fingerprint: string;
  /** True when last POST/poll ended without a clear success/error/pending. */
  unclear: boolean;
};

/** Stable fingerprint for idempotency reuse — includes answers + consent. */
export function redeemPayloadFingerprint(payload: RedeemAttemptPayload): string {
  const answerKeys = Object.keys(payload.answers).sort();
  const answers: Record<string, FormAnswerValue> = {};
  for (const key of answerKeys) {
    const value = payload.answers[key];
    if (value !== undefined) answers[key] = value;
  }
  return JSON.stringify({
    tenantId: payload.tenantId.trim(),
    eventId: payload.eventId.trim(),
    code: payload.code.trim(),
    formVersion: payload.formVersion.trim(),
    termsVersion: payload.termsVersion.trim(),
    answers,
    termsAccepted: payload.termsAccepted === true,
  });
}

/**
 * Reuse the same idempotency-key only when outcome is still unknown and payload matches.
 * Changed answers/consent/code always gets a fresh key.
 */
export function resolveIdempotencyKey(
  existing: RedeemAttempt | null,
  fingerprint: string,
  createKey: () => string,
): { key: string; reused: boolean } {
  if (existing?.unclear && existing.fingerprint === fingerprint && existing.key) {
    return { key: existing.key, reused: true };
  }
  return { key: createKey(), reused: false };
}
