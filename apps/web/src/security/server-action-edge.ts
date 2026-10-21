/**
 * Edge-safe guard for bogus Server Action POSTs.
 *
 * @ticket/web does not ship any `"use server"` actions — legitimate traffic never
 * sends `next-action`. Probes (short strings like `x`, `action`, `0`, `1`) hit
 * Next.js manifest lookup and spam `failed-to-find-server-action` logs (Issue #1021).
 */
export function isServerActionPost(input: {
  method: string;
  nextActionHeader: string | null | undefined;
}): boolean {
  if (input.method !== 'POST') return false;
  const raw = input.nextActionHeader;
  if (raw === null || raw === undefined) return false;
  return raw.trim().length > 0;
}
