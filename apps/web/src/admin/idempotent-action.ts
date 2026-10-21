export type UnclearAttempt = {
  key: string;
  fingerprint: string;
  unclear: boolean;
};

/** Reuse the same idempotency key after an unclear (timeout/network) outcome. */
export function reuseUnclearKey(
  existing: UnclearAttempt | null,
  fingerprint: string,
): string {
  if (
    existing?.unclear &&
    existing.fingerprint === fingerprint &&
    existing.key
  ) {
    return existing.key;
  }
  return crypto.randomUUID();
}
