export type RedeemAttemptPayload = {
  tenantId: string;
  eventId: string;
  code: string;
  formVersion: string;
  termsVersion: string;
};

export type RedeemAttempt = {
  key: string;
  fingerprint: string;
  /** True when last POST/poll ended without a clear success/error (timeout/network). */
  unclear: boolean;
};

export function redeemPayloadFingerprint(payload: RedeemAttemptPayload): string {
  return JSON.stringify({
    tenantId: payload.tenantId.trim(),
    eventId: payload.eventId.trim(),
    code: payload.code.trim(),
    formVersion: payload.formVersion.trim(),
    termsVersion: payload.termsVersion.trim(),
  });
}

/**
 * Reuse the same idempotency-key only when outcome is still unknown and payload matches.
 * Changed payload always gets a fresh key (avoids IDEMPOTENCY_CONFLICT).
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
